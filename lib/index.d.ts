/// <reference types="node" />
import hyperdrive from 'hyperdrive';
import fs from 'fs';
declare class Hyperdrive extends hyperdrive {
    #private;
    constructor(store: any, dkey?: any);
    get peers(): any[];
    get metadata(): any;
    get closed(): boolean;
    get readable(): boolean;
    get writable(): boolean;
    exists(path: fs.PathLike): Promise<boolean>;
    list(path: any, { recursive, stat }?: {
        recursive: boolean;
        stat: boolean;
    }): Promise<any[]>;
    stat(path: fs.PathLike): Promise<{
        isDirectory: () => boolean;
        items: number;
    } | {
        key: string;
        seq: number;
        executable: Boolean;
        linkname: string;
        isDirectory: () => boolean;
        blockOffset?: number;
        blockLength?: number;
        byteOffset?: number;
        byteLength?: number;
        items?: undefined;
    }>;
    rmdir(path: fs.PathLike): Promise<void>;
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
    write(file: any, content: any, encoding: any): Promise<void>;
    read(file: any, encoding: any): Promise<any>;
    copy(source: string, dest: string): Promise<void>;
    export(drive_src?: string, fs_dest?: string): Promise<void>;
    import(fs_src?: string, drive_dest?: string): Promise<void>;
}
export default Hyperdrive;
