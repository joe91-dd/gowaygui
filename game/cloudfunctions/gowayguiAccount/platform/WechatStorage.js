"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wechatStorage = wechatStorage;
const FILE_PREFIX = '@gowaygui-save-file-v1:';
let sequence = 0;
function checksum(value) { let h = 2166136261; for (let i = 0; i < value.length; i++)
    h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
/** Small values stay compatible. Large saves commit a checked private file by swapping one small pointer. */
function wechatStorage(api = typeof wx === 'undefined' ? undefined : wx) {
    if (!api)
        throw Error('微信存储接口不可用');
    const storage = api, fs = storage.getFileSystemManager?.(), directory = storage.env?.USER_DATA_PATH + '/gowaygui-saves-v1';
    let directoryReady = false;
    const pointer = (raw, key) => {
        if (typeof raw !== 'string' || !raw.startsWith(FILE_PREFIX))
            return;
        let p;
        try {
            p = JSON.parse(raw.slice(FILE_PREFIX.length));
        }
        catch {
            throw Error('本地存档索引损坏，原资料已保留');
        }
        if (!p || p.key !== key || !/^[a-f0-9]+-[a-z0-9-]+\.save$/.test(p.name) || !Number.isSafeInteger(p.length) || p.length < 0 || !/^[a-f0-9]+$/.test(p.hash))
            throw Error('本地存档索引损坏，原资料已保留');
        return p;
    };
    const unlink = (p) => { if (p && fs && storage.env?.USER_DATA_PATH)
        try {
            fs.unlinkSync(directory + '/' + p.name);
        }
        catch { /* Obsolete files may be reclaimed on a later launch. */ } };
    const quotaError = (error) => /maximum size of the file storage|storage limit.*exceed|no space|disk full|ENOSPC/i.test(String(error?.message || error?.errMsg || error));
    const sweepUncommitted = () => {
        if (!fs?.readdirSync || !storage.env?.USER_DATA_PATH)
            return;
        // Enumerate every account/recovery/outbox key. Any unreadable index stops cleanup.
        try {
            const live = new Set();
            for (const k of storage.getStorageInfoSync().keys) {
                const p = pointer(storage.getStorageSync(k), k);
                if (p)
                    live.add(p.name);
            }
            for (const name of fs.readdirSync(directory))
                if (/^[a-f0-9]+-[a-z0-9-]+\.save$/.test(name) && !live.has(name))
                    try {
                        fs.unlinkSync(directory + '/' + name);
                    }
                    catch { }
        }
        catch { /* Unknown ownership must never trigger removal. */ }
    };
    return {
        getItem(key) {
            const value = storage.getStorageSync(key);
            if ((value === '' || value === undefined || value === null) && !storage.getStorageInfoSync().keys.includes(key))
                return null;
            if (typeof value !== 'string')
                throw Error('本地存储资料格式异常，原始资料已保留，请先导出修复。');
            const p = pointer(value, key);
            if (!p)
                return value;
            if (!fs || !storage.env?.USER_DATA_PATH)
                throw Error('本地存档文件接口不可用，请重新打开微信');
            const content = fs.readFileSync(directory + '/' + p.name, 'utf8');
            if (typeof content !== 'string' || content.length !== p.length || checksum(content) !== p.hash)
                throw Error('本地存档文件校验失败，原资料已保留');
            return content;
        },
        setItem(key, value) {
            const old = pointer(storage.getStorageSync(key), key);
            // UTF-16 length * 3 bounds UTF-8 size, leaving ample room below WeChat's per-key limit.
            if (value.length * 3 < 384 * 1024) {
                storage.setStorageSync(key, value);
                unlink(old);
                return;
            }
            if (!fs || !storage.env?.USER_DATA_PATH)
                throw Error('存档较大，需要微信文件存储支持；进度已保留，请更新微信后重试');
            if (!directoryReady) {
                try {
                    fs.mkdirSync(directory, true);
                }
                catch { /* write below verifies directory availability. */ }
                directoryReady = true;
            }
            const p = { name: checksum(key) + '-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2) + '.save', length: value.length, hash: checksum(value), key };
            try {
                try {
                    fs.writeFileSync(directory + '/' + p.name, value, 'utf8');
                }
                catch (error) {
                    if (!quotaError(error))
                        throw error;
                    unlink(p);
                    sweepUncommitted();
                    // One bounded synchronous retry. Never overwrite the committed primary or backup.
                    storage.__gowayguiFileSpace?.reclaim(Math.max(8 * 1024 * 1024, value.length * 3));
                    try {
                        fs.writeFileSync(directory + '/' + p.name, value, 'utf8');
                    }
                    catch (retryError) {
                        if (quotaError(retryError))
                            throw Error('游戏存储空间不足，原进度已保留。请退出小游戏后重新打开，再重试保存；不要清除游戏数据。');
                        throw retryError;
                    }
                }
                const check = fs.readFileSync(directory + '/' + p.name, 'utf8');
                if (check !== value)
                    throw Error('存档写入校验失败');
                storage.setStorageSync(key, FILE_PREFIX + JSON.stringify(p));
            }
            catch (error) {
                unlink(p);
                throw error;
            }
            unlink(old);
        },
        removeItem(key) { const p = pointer(storage.getStorageSync(key), key); storage.removeStorageSync(key); unlink(p); },
        get length() { return storage.getStorageInfoSync().keys.length; },
        key: index => storage.getStorageInfoSync().keys[index] ?? null,
    };
}
