import Stream from 'user-stream';
import Rx from 'rx';
import {readConfig} from './conf';

const fromEvent = Rx.Observable.fromEvent;

const config = readConfig();


import {Intelligence} from './intelligence';
import {Memory} from './memory';
import {TagFollowers} from './follow';

const memory = new Memory(config.redisUri, 'metagu');
const tagFollowers = new TagFollowers(memory);

const intelligence = new Intelligence(tagFollowers);


const stream = new Stream({
    consumer_key:        config.twitterConsumerKey,
    consumer_secret:     config.twitterConsumerSecret,
    access_token_key:    config.twitterAccessTokenKey,
    access_token_secret: config.twitterAccessTokenSecret
});


stream.stream({with: 'user'});

const twitterHandle = config.twitterHandle;
const mentionPrefix = new RegExp(`^\.?@${twitterHandle} +`, 'i');


const data  = fromEvent(stream, 'data');
const error = fromEvent(stream, 'error').flatMap(Rx.Observable.throw);
const end   = fromEvent(stream, 'end');

const obs = data.merge(error).takeUntil(end);

const tweets = obs.filter(tweet => !! tweet.id_str);
const mentions = tweets.filter(tweet => tweet.text.match(mentionPrefix));

// TODO: retry after delay on 503 { type: 'response', data: { code: 503 } }
mentions.
    subscribe(tweet => {
        const author = tweet.user.screen_name;
        const tweetContent = tweet.text.replace(mentionPrefix, '');
        const tweetId = tweet.id_str;
        console.log(`Received from @${author}: ${tweetContent}`);
        intelligence.respond(tweetContent, author).
            flatMap(reply => {
                console.log(`Respond to @${author}: ${reply}`);
                return post(author, reply, tweetId);
            }).
            // TODO: flatmap the whole stream
            subscribe();
    }, error => {
        console.error("ERROR", error);
    });


import twitterClient from 'twitter-node-client';
const {Twitter} = twitterClient;

const twitter = new Twitter({
    consumerKey:       config.twitterConsumerKey,
    consumerSecret:    config.twitterConsumerSecret,
    accessToken:       config.twitterAccessTokenKey,
    accessTokenSecret: config.twitterAccessTokenSecret
});

function post(recipient, message, replyTweetId) {
    return Rx.Observable.create(observer => {
        const tweet = {
            status: `@${recipient} ${message}`,
            in_reply_to_status_id: replyTweetId
        };
        console.log('Posting tweet', tweet);
        twitter.postTweet(
            tweet,
            error => { observer.onError(error); observer.onCompleted(); },
            resp  => { observer.onNext(resp);   observer.onCompleted(); }
        );
    });
}



// TODO: Use CAPI stream
// const capiEvents$ = ...
// const publishingEvents$ = capiEvents$.filter(event => event.xxxx)
// const publishedContent$ = publishingEvents$.map(event => event.content)

import {getPublishedContent$} from './capi-feed';

const publishedContent$ = getPublishedContent$();

const publishedContentAndFollower$ = publishedContent$.flatMap(content => {
    const tags = content.tags;
    return Rx.Observable.from(tags).
        flatMap(tag => tagFollowers.get$(tag)).
        distinct().
        map(nickname => ({content, nickname}));
});

publishedContentAndFollower$.subscribe(({content, nickname}) => {
    // TODO: give context, 'new XY'?
    const message = `${content.webTitle} ${content.webUrl}`;
    post(nickname, message);
}, error => {
    console.error("FOLLOW ERROR", error);
});



// Dummy HTTP server to keep alive on heroku

import http from 'http';

const PORT = process.env.PORT || 5000;

var server = http.createServer(function(request, response) {
    response.writeHead(200, {"Content-Type": "text/html"});
    response.write('hello there');
    response.end();
});

server.listen(PORT);
console.log(`HTTP server listening on ${PORT}`);
