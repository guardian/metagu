import redis from 'redis';

export class Memory {
    constructor(server, prefix) {
        this._server = server;
        this._prefix = prefix;

        this._connectionUsers = 0
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
        return this._withClient(client => {
            return new Promise((resolve, reject) => {
                client[method](...args, function (err, resp) {
                    if (err) reject(err);
                    else resolve(resp);
                });
            });
        });
    }

    _withClient(callback) {
        // Cache client during concurrent requests to ensure no more
        // than one connection is used
        if (! this._client) {
            this._client = redis.createClient(this._server, {parser: 'javascript'});
        }

        const outcome = callback(this._client);

        this._connectionUsers++;

        function done() {
            this._connectionUsers--;
            if (this._connectionUsers === 0) {
                this._client.quit();
                delete this._client;
            }
        }

        outcome.then(done, done);
        return outcome;
    }

    _makeKey(key) {
        return [this._prefix, key].join(':');
    }
}
