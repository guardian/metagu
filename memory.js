import redis from 'redis';

export class Memory {
    constructor(server, prefix) {
        this._prefix = prefix;
        this._client = redis.createClient(server, {parser: 'javascript'});
    }

    getSet(key) {
        return this._invoke('smembers', this._makeKey(key));
    }

    addToSet(key, value) {
        return this._invoke('sadd', this._makeKey(key), value);
    }

    removeFromSet(key, value) {
        return this._invoke('srem', this._makeKey(key), value);
    }

    close() {
        this._client.quit();
    }


    _invoke(method, ...args) {
        return new Promise((resolve, reject) => {
            this._client[method](...args, function (err, resp) {
                if (err) reject(err);
                else resolve(resp);
            });
        });
    }

    _makeKey(key) {
        return [this._prefix, key].join(':');
    }
}
