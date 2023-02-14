/// <reference types="node" />
import hyperdrive from 'hyperdrive';
import { Readable, Writable } from 'streamx';
import type HyperBee from 'hyperbee';
import type * as TT from './typings';
import { LocalDrive } from './localdrive.js';
declare class Hyperdrive extends hyperdrive {
    #private;
    stats: HyperBee;
    local: LocalDrive;
    private _list;
    private _readdir;
    constructor(store: any, dkey?: string | Buffer, localDriveRoot?: string);
    get peers(): any;
    get metadata(): any;
    get closed(): boolean;
    get readable(): boolean;
    get writable(): boolean;
    readdir<S extends boolean = false, B extends boolean = false>(folder?: string, { withStats, nameOnly, fileOnly, readable, search }?: TT.ReadDirOpts<S, B>): TT.ReadDir<S, B>;
    list<S extends boolean = false, B extends boolean = false>(folder: string, { recursive, withStats, fileOnly, readable, search }?: Partial<{
        recursive: boolean;
        withStats: S;
        fileOnly: boolean;
        readable: B;
        search: string | RegExp;
    }>): TT.List<S, B>;
    throwErrorOnExists(path: string, isDir?: boolean): Promise<void>;
    write(path: string, content: any, encoding: any): Promise<TT.Node>;
    put(path: string, blob: Buffer, opts?: any): Promise<TT.Node>;
    read(path: string, encoding: any): Promise<any>;
    del(path: string): Promise<TT.Node>;
    rmDir(path: any, { recursive }?: {
        recursive?: boolean;
    }): Promise<void>;
    copy(source: string, dest: string): Promise<TT.Node>;
    move(source: string, dest: string): Promise<TT.Node>;
    createFolderReadStream(path: string): Readable<any, any, any, true, false, import("streamx").ReadableEvents<any>>;
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
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<TT.Stat>;
    getDirs(path: string, { exclude, resolve }?: {
        exclude?: string;
        resolve?: boolean;
    }): Promise<string[]>;
    export(path?: string, localPath?: string): Promise<void>;
    import(localPath?: string, path?: string): Promise<void>;
}
export default Hyperdrive;
export { LocalDrive, Hyperdrive };
