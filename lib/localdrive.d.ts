import { Readable, Writable } from 'streamx';
import * as fs from 'fs';
import { Item, ListOpts } from './typings';
type Files<S> = AsyncGenerator<Item<S> & {
    absolutePath: string;
}, undefined>;
export declare class LocalDrive {
    #private;
    root: string;
    createReadStream: typeof fs.createReadStream;
    createWriteStream: typeof fs.createWriteStream;
    constructor(root?: string);
    resolvePath(path: string): string;
    resolveRelativePath(path: string): string;
    filesGenerator<S extends boolean = false>(dirPath: string, { recursive, fileOnly, withStats, search }?: Omit<Partial<{
        recursive: boolean;
        withStats: S;
        fileOnly: boolean;
        readable: boolean;
        search: string | RegExp;
    }>, "readable">): Files<S>;
    list<S extends boolean = false>(path: string, opts: Omit<ListOpts<S>, 'readable'>): Promise<(Item<S> & {
        absolutePath: string;
    })[]>;
    createFolderReadStream(path: any): Readable<any>;
    createFolderWriteStream(path: string): Writable<{
        path: string;
        readable: Readable;
    }>;
}
export {};
