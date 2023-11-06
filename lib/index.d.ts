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
    constructor(store: any, dkey?: string | Buffer | Record<string, any>, localDriveRoot?: string);
    get peers(): any;
    get metadata(): any;
    get readable(): boolean;
    get writable(): boolean;
    readdir<S extends boolean = false, B extends boolean = false, N extends boolean = false>(folder?: string, { withStats, nameOnly, fileOnly, readable, search }?: TT.ReadDirOpts<S, B, N>): TT.ReadDir<S, B, N>;
    list<S extends boolean = false, B extends boolean = false>(folder: string, { recursive, withStats, fileOnly, readable, search }?: Partial<{
        recursive: boolean;
        withStats: S;
        fileOnly: boolean;
        readable: B;
        search: string | RegExp;
    }>): TT.List<S, B>;
    throwErrorOnExists(path: string, isDir?: boolean): Promise<void>;
    write(path: string, content: any, encoding?: BufferEncoding): Promise<TT.Node>;
    put(path: string, blob: Buffer, { awaitStats, ...opts }?: {
        executable?: boolean;
        awaitStats?: boolean;
        metadata?: Record<string, any>;
    }): Promise<TT.Node>;
    read(path: string, encoding?: BufferEncoding): Promise<any>;
    del(path: string, { awaitStats }?: {
        awaitStats?: boolean;
    }): Promise<TT.Node>;
    rmDir(path: any, { recursive }?: {
        recursive?: boolean;
    }): Promise<void>;
    copy(source: string, dest: string, { awaitStats }?: {
        awaitStats?: boolean;
    }): Promise<TT.Node>;
    move(source: string, dest: string, { awaitStats }?: {
        awaitStats?: boolean;
    }): Promise<TT.Node>;
    createWriteStream(path: string, opts?: {
        executable?: boolean;
        metadata?: any;
    }): Writable<any>;
    createFolderReadStream(path: string): Readable<any>;
    createFolderWriteStream(path: string, { awaitStats }?: {
        awaitStats?: boolean;
    }): Writable<{
        path: string;
        readable: Readable;
    }>;
    isDirectory(path: string): Promise<boolean>;
    exists(path: string): Promise<boolean>;
    stat(path: string, { isDir }?: {
        isDir?: boolean;
    }): Promise<TT.Stat>;
    getDirs(path: string, { exclude, resolve }?: {
        exclude?: string;
        resolve?: boolean;
    }): Promise<string[]>;
    export(path?: string, localPath?: string): Promise<void>;
    import(localPath?: string, path?: string): Promise<void>;
}
export default Hyperdrive;
export { LocalDrive, Hyperdrive };
