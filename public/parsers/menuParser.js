import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { MENU_URL, META } from '../config.js';
import { generateId } from '../utils/generateId.js';
import { translateFood } from '../utils/translateFood.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf-8')
);

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Atoktobekov/yemekhane-cdn@main';

function resolvePhotos(id, originalUrl) {
    if (manifest.ids.includes(id)) {
        return {
            thumbUrl: `${CDN_BASE}/thumb/${id}.jpg`,
            fullPhotoUrl: `${CDN_BASE}/full/${id}.jpg`,
        };
    }
    return {
        thumbUrl: originalUrl ?? null,
        fullPhotoUrl: originalUrl ?? null,
    };
}

export async function fetchAndParseMenu() {
    const response = await axios.get(MENU_URL);
    const $ = cheerio.load(response.data);

    const foods = new Map();
    const menus = [];

    let currentDate = null;
    let currentItems = [];

    // Плоский обход: img, h5, h6 идут последовательно
    // Перед каждым h5 с блюдом стоит img с фото
    const elements = $('img, h5, h6').toArray();

    let lastImgSrc = null; // последний встреченный img до h5 с блюдом

    for (const element of elements) {
        const $el = $(element);
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'img') {
            const src = $el.attr('src');
            // Игнорируем логотипы и служебные картинки
            if (src && src.includes('/kantin/foods/')) {
                lastImgSrc = src;
            }
            continue;
        }

        const text = $el.text().replace(/\s+/g, ' ').trim();

        if (tagName === 'h5') {
            const dateMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);

            if (dateMatch) {
                if (currentDate && currentItems.length > 0) {
                    menus.push({ date: currentDate, items: [...currentItems] });
                }
                const [, day, month, year] = dateMatch;
                currentDate = `${year}-${month}-${day}`;
                currentItems = [];
                lastImgSrc = null; // дата — не блюдо, сбрасываем
                continue;
            }

            if (text && !text.match(/^\d/) && text !== 'YEMEKHANE' && text !== 'MENÜ') {
                const foodName = text.replace(/\*+/g, '').trim();
                const id = generateId(foodName);

                if (!foods.has(id)) {
                    const translation = translateFood(foodName);
                    foods.set(id, {
                        id,
                        name: {
                            tr: foodName,
                            ru: translation.ru,
                            en: translation.en
                        },
                        calories: 0,
                        // фото пока не знаем — запишем после h6
                        _originalUrl: lastImgSrc,
                    });
                }

                currentItems.push(id);
                lastImgSrc = null; // сбрасываем, чтобы следующее блюдо не взяло чужое фото
            }
        }

        if (tagName === 'h6') {
            const calorieMatch = text.match(/Kalori:\s*(\d+)/i);

            if (calorieMatch && currentItems.length > 0) {
                const calories = parseInt(calorieMatch[1], 10);
                const lastItemId = currentItems[currentItems.length - 1];
                const food = foods.get(lastItemId);

                if (food) {
                    if (food.calories === 0) {
                        food.calories = calories;
                    }
                    // Применяем фото только один раз (при первом появлении блюда)
                    if (!('thumbUrl' in food)) {
                        const { thumbUrl, fullPhotoUrl } = resolvePhotos(food.id, food._originalUrl);
                        food.thumbUrl = thumbUrl;
                        food.fullPhotoUrl = fullPhotoUrl;
                    }
                }
            }
        }
    }

    if (currentDate && currentItems.length > 0) {
        menus.push({ date: currentDate, items: [...currentItems] });
    }

    // Убираем служебное поле _originalUrl из финального результата
    const foodsArray = Array.from(foods.values()).map(({ _originalUrl, ...food }) => food);

    return {
        foods: foodsArray,
        menus,
        meta: {
            ...META,
            lastUpdated: new Date().toISOString()
        }
    };
}