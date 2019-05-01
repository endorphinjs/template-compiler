import { HelpersMap } from "../types";

type PlainObject = { [key: string]: string };

const defaultHelpers = {
    'endorphin/helpers.js': ['emit', 'setState', 'setStore']
}

/**
 * Generates helpers lookup map
 */
export default function prepareHelpers(...helpers: HelpersMap[]): PlainObject {
    const result: PlainObject = {};
    const items = [defaultHelpers, ...helpers];
    items.forEach(helper => {
        Object.keys(helper).forEach(key => {
            helper[key].forEach(value => result[value] = key);
        });
    });

    return result;
}
