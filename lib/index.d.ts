/// <reference types="node" />
/// <reference types="node" />
import hyperdrive from 'hyperdrive';
import fs from 'fs';
import type HyperBee from 'hyperbee';
declare class Hyperdrive extends hyperdrive {
    #private;
    folders: HyperBee;
    stats: HyperBee;
    constructor(store: any, dkey?: any);
    get peers(): any[];
    get metadata(): any;
    get closed(): boolean;
    get readable(): boolean;
    get writable(): boolean;
    readdir(folder?: string): any;
    exists(path: fs.PathLike): Promise<boolean>;
    list(path: string, { recursive, stat }?: {
        recursive?: boolean;
        stat?: boolean;
    }): Promise<any[]>;
    stat(path: string): Promise<any>;
    del(path: string, resolveStats?: boolean): Promise<any>;
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
    resolveDirs(path: string): string[];
    write(path: string, content: any, encoding: any): Promise<void>;
    put(path: string, blob: Buffer, opts?: any): Promise<void>;
    read(path: string, encoding: any): Promise<any>;
    copy(source: string, dest: string): Promise<void>;
    export(drive_src?: string, fs_dest?: string): Promise<void>;
    import(fs_src?: string, drive_dest?: string): Promise<void>;
}
export default Hyperdrive;
