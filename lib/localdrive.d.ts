/// <reference types="node" />
import { Readable, Writable } from 'streamx';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
interface ListOpts {
    recursive: boolean;
    fileOnly: boolean;
    withStats: boolean;
    search: RegExp | string;
}
export declare class LocalDrive {
    #private;
    root: string;
    fsp: typeof fsp;
    createReadStream: typeof fs.createReadStream;
    createWriteStream: typeof fs.createWriteStream;
    constructor(root?: string);
    resolvePath(path: any): string;
    filesGenerator(dirPath: string, { recursive, fileOnly, withStats, search }?: ListOpts): any;
    list(path: any, opts: ListOpts): unknown[];
    createFolderReadStream(path: any): Readable<any, any, any, true, false, import("streamx").ReadableEvents<any>>;
    createFolderWriteStream(path: string): Writable<{
        path: string;
        readable: Readable;
    }, {
        path: string;
        readable: Readable;
    }, {
        path: string;
        readable: Readable;
    }, false, true, import("streamx").WritableEvents<{
        path: string;
        readable: Readable;
    }>>;
}
export {};
