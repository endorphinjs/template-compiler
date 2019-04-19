import * as fs from 'fs';
import * as path from 'path';
import compile from '../src/index';

describe('New compiler', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8').trim();
    }

    it.only('debug', () => {
        const file = 'templates/basic2.html';
        const { code } = compile(read(`./samples/${file}`), file);
        fs.writeFileSync(path.resolve(__dirname, `./fixtures2/${file.replace(/\.html$/, '.js')}`), code.trim());
        console.log(code);
    });
});
