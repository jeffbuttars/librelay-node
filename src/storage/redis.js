

const redis = require('redis');
const process = require('process');
const unifyOptions = require('redis/lib/createClient');


/* A proper async redis client */
class AsyncRedisClient extends redis.RedisClient {

    static createClient(...args) {
        const options = unifyOptions.apply(null, args);
        return new this(options);
    }

    _async(func, ...args) {
        return new Promise(function(resolve, reject) {
            args.push(function(err, reply) {
                if (err !== null) {
                    reject(err);
                } else {
                    resolve(reply);
                }
            });
            func.apply(this, args);
        }.bind(this));
    }

    async get(key) {
        return await this._async(super.get, key);
    }

    async set(key, value) {
        return await this._async(super.set, key, value);
    }

    async keys(pattern) {
        return await this._async(super.keys, pattern);
    }

    async del(key) {
        return await this._async(super.del, key);
    }
}


console.log(`Connecting to redis: ${process.env.REDIS_URL || "localhost"}`);
module.exports = AsyncRedisClient.createClient(process.env.REDIS_URL);
