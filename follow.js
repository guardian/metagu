import Rx from 'rx';

import {Memory} from './memory';

// TODO: pass server in from caller so as not to depend on config
import {readConfig} from './conf';
const config = readConfig();
const server = config.redisUri;

export function addFollower$(tag, nickname) {
    const memory = new Memory(server, 'metagu');
    const key = `followers:${tag.id}`;
    return Rx.Observable.fromPromise(memory.addToSet(key, nickname))
        .finally(() => memory.close());
}

export function getFollowers$(tag) {
    const memory = new Memory(server, 'metagu');
    const key = `followers:${tag.id}`;
    const followerList$ = Rx.Observable.fromPromise(memory.getSet(key));
    return followerList$.flatMap(Rx.Observable.from)
        .finally(() => memory.close());
}
