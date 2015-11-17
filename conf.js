import fs from 'fs';

let cachedConfigFile;

function fromConfigFile(key) {
    try {
        cachedConfigFile = cachedConfigFile || JSON.parse(fs.readFileSync('./dev.config.json'));
        return cachedConfigFile[key];
    } catch(e) {
        return;
    }
}

function fromEnv(key) {
    return process.env[key];
}

function readKey(key) {
    const value = fromEnv(key) || fromConfigFile(key);
    if (! value) {
        throw new Error(`Missing config for: ${key}`);
    }
    return value;
}

export function readConfig() {
    return {
        twitterHandle:            readKey("TWITTER_HANDLE"),
        twitterConsumerKey:       readKey("TWITTER_CONSUMER_KEY"),
        twitterConsumerSecret:    readKey("TWITTER_CONSUMER_SECRET"),
        twitterAccessTokenKey:    readKey("TWITTER_ACCESS_TOKEN_KEY"),
        twitterAccessTokenSecret: readKey("TWITTER_ACCESS_TOKEN_SECRET")
    };
}
