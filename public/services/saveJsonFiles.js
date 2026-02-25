import fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { fetchAndParseMenu } from '../parsers/menuParser.js';
import { fetchAndParseKiraathane } from '../parsers/kiraathaneParser.js';

// Получаем директорию текущего файла
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function saveJsonFiles() {
    const menuData = await fetchAndParseMenu();
    const kiraathaneData = await fetchAndParseKiraathane();

    const menuPath = path.join(__dirname, "../menu.json");
    const buffetPath = path.join(__dirname, "../buffet.json");


    await fs.writeFile(menuPath, JSON.stringify(menuData, null, 2));
    await fs.writeFile(buffetPath, JSON.stringify(kiraathaneData, null, 2));

    console.log('Files updated successfully');
}
