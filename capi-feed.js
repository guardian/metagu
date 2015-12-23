import Rx from 'rx';
import request from 'request';
import extend from 'extend';

import {readConfig} from './conf';

const config = readConfig();

const CAPI_API_KEY = config.capiApiKey;
const CAPI_BASE_URI = config.capiBaseUri;

export function latestContent$(limit = 30) {
    return rxRequest({
        uri: `${CAPI_BASE_URI}/search`,
        qs: {
            'api-key': CAPI_API_KEY,
            limit: limit,
            'show-tags': 'all'
        }
    }).map(response => JSON.parse(response.body).response.results);
}


const POLLING_INTERVAL_SEC = 60;

function contentWithDate(content) {
    return extend(content, {
        webPublicationDate: new Date(content.webPublicationDate)
    });
}

export function getPublishedContent$() {
    return Rx.Observable.interval(POLLING_INTERVAL_SEC * 1000).startWith(0)
        .flatMap(() => latestContent$())
        .scan(({results, latestPubDate}, rawContentList) => {
            const contentList = rawContentList.map(contentWithDate);
            const newResults = rawContentList.filter(c => c.webPublicationDate > latestPubDate);
            const newLatestPubDate = newResults.map(c => c.webPublicationDate).sort().slice(-1)[0] || latestPubDate;
            return {
                results: newResults,
                latestPubDate: newLatestPubDate
            };
        }, {latestPubDate: new Date(), results: []})
        .flatMap(({results}) => Rx.Observable.from(results));
}


// FIXME: don't duplicate from intelligence.js, import other CAPI helpers

// Rx wrapper for Node request
// const rxRequest = Rx.Observable.fromNodeCallback(request)
function rxRequest(options) {
    return Rx.Observable.create(observer => {
        request(options, (error, response) => {
            if (error) {
                observer.onError(error);
            } else {
                observer.onNext(response);
            }
            observer.onCompleted();
        });
    });
}
