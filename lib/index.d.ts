/// <reference types="node" />
/// <reference types="node" />
import hyperdrive from 'hyperdrive';
import fs from 'fs';
import { Readable, Writable } from 'streamx';
import type HyperBee from 'hyperbee';
import type * as TT from './typings';
declare class Hyperdrive extends hyperdrive {
    #private;
    stats: HyperBee;
    constructor(store: any, dkey?: any);
    get peers(): any;
    get metadata(): any;
    get closed(): boolean;
    get readable(): boolean;
    get writable(): boolean;
    readdir<S extends boolean, B extends boolean>(folder?: string, { withStats, nameOnly, fileOnly, readable, search }?: TT.ReadDirOpts<S, B>): TT.ReadDir<S, B>;
    list<S extends boolean, B extends boolean>(path: string, { recursive, withStats, fileOnly, readable, search }?: Partial<{
        recursive: boolean;
        withStats: S;
        fileOnly: boolean;
        readable: B;
        search: string | RegExp;
    }>): TT.List<S, B>;
    write(path: string, content: any, encoding: any): Promise<void>;
    put(path: string, blob: Buffer, opts?: any): Promise<void>;
    read(path: string, encoding: any): Promise<any>;
    del(path: string, resolveStats?: boolean): Promise<any>;
    copy(source: string, dest: string): Promise<void>;
    move(source: string, dest: string): Promise<void>;
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
    exists(path: fs.PathLike): Promise<boolean>;
    stat(path: string): Promise<TT.Stat>;
    getDirs(path: string, exclude?: string): string[];
    export(drive_src?: string, fs_dest?: string): Promise<void>;
    import(fs_src?: string, drive_dest?: string): Promise<void>;
    $list(dir?: string, recursive?: boolean, { offset, limit, page, filter, show_hidden, ordering, search, sorting }?: {
        offset?: number;
        limit?: number;
        page?: number;
        filter?: boolean;
        show_hidden?: boolean;
        ordering?: number;
        search?: string;
        sorting?: string;
    }): Promise<void>;
}
export default Hyperdrive;
