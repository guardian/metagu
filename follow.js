import Rx from 'rx';

export class TagFollowers {
    constructor(memory) {
        this._memory = memory;
    }

    add$(tag, nickname) {
        const key = `followers:${tag.id}`;
        return Rx.Observable.fromPromise(this._memory.addToSet(key, nickname));
    }

    get$(tag) {
        const key = `followers:${tag.id}`;
        const followerList$ = Rx.Observable.fromPromise(this._memory.getSet(key));
        return followerList$.flatMap(Rx.Observable.from);
    }
}
