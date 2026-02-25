import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { KIRAATHANE_URL } from '../config.js';
import { generateId } from '../utils/generateId.js';
import { categoryTranslations } from '../utils/translateFood.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'buffet_manifest.json'), 'utf-8')
);

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Atoktobekov/buffet-cdn@main/images';

function resolvePhoto(id, originalUrl) {
    if (manifest.ids.includes(id)) {
        return `${CDN_BASE}/${id}.jpg`;
    }
    return originalUrl ?? null;
}

export async function fetchAndParseKiraathane() {
    const response = await axios.get(KIRAATHANE_URL);
    const $ = cheerio.load(response.data);

    const categories = [];
    let currentCategory = null;
    let lastImgSrc = null;

    const elements = $('img, h4, h5, h6').toArray();

    for (const element of elements) {
        const $el = $(element);
        const tagName = element.tagName.toLowerCase();
        const text = $el.text().trim();

        if (tagName === 'img') {
            const src = $el.attr('src');
            if (src && src.includes('/kantin/')) {
                lastImgSrc = src;
            }
            continue;
        }

        if (tagName === 'h4') {
            const categoryName = text.toLocaleUpperCase('tr-TR');
            const translation = categoryTranslations[categoryName];

            if (translation) {
                currentCategory = {
                    id: translation.id,
                    title: translation.title,
                    items: []
                };
                categories.push(currentCategory);
            } else if (categoryName && categoryName !== 'KIRAATHANEMİZ' && !categoryName.includes('MENÜ')) {
                currentCategory = {
                    id: generateId(categoryName),
                    title: categoryName,
                    items: []
                };
                categories.push(currentCategory);
            }
            lastImgSrc = null;
            continue;
        }

        if (tagName === 'h5' && currentCategory) {
            const itemName = text.toUpperCase();
            if (itemName && !itemName.includes('FİYATI')) {
                const id = generateId(itemName);
                currentCategory.items.push({
                    id,
                    name: itemName,
                    price: 0,
                    photoUrl: resolvePhoto(id, lastImgSrc),
                });
                lastImgSrc = null;
            }
            continue;
        }

        if (tagName === 'h6' && currentCategory && currentCategory.items.length > 0) {
            const priceMatch = text.match(/(\d+)/);
            if (priceMatch) {
                const lastItem = currentCategory.items[currentCategory.items.length - 1];
                if (lastItem.price === 0) {
                    lastItem.price = parseInt(priceMatch[1], 10);
                }
            }
        }
    }

    return {
        categories: categories.filter(cat => cat.items.length > 0),
        meta: {
            timezone: 'Asia/Bishkek',
            currency: 'KGS',
            lastUpdated: new Date().toISOString()
        }
    };
}