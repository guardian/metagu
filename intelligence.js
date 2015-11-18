import Rx from 'rx';
import moment from 'moment';
import request from 'request';
import extend from 'extend';

const just = Rx.Observable.just;
const justThrow = Rx.Observable.throw;

export function respond(input) {

    // TODO: this shouldn't be necessary, could be losing real information
    input = input.
        replace(/please/g, '').
        replace(/.+ thanks/g, ''). // strip thanks if not on its own
        trim();

    let m;
    if (input.match(/^(hi|hello)\s*[!?.]*$/)) {
        const greeting = choose([
            'hey',
            'heya',
            'hey there',
            'hi!',
            'hello',
        ]);
        return just(greeting);
    }
    if (input.match(/^(thanks|thank you)\s*[!?.]*$/)) {
        const nw = choose([
            'no worries',
            'you\'re welcome',
            'don\'t mention it',
            'my pleasure',
        ]);
        return just(nw);
    }
    if (input.match(/(who|what) are you/)) {
        return just(`I'm just a little pseudo-AI bot for the Guardian. I'm still learning!`);
    }
    if (input.match(/who (made|created|built|invented) you/)) {
        return just(`.@theefer created me at a Guardian hack day in November 2015`);
    }
    if (input.match(/what is the time/)) {
        const now = moment();
        const time = now.format('HH:mm');
        return just(`it's ${time}`);
    }
    if (input.match(/^[-+*/0-9 ]+$/)) {
        try {
            const result = eval(input);
            if (result === NaN || result === Infinity || result === -Infinity) {
                return just('that didn\'t compute');
            } else {
                return just(result);
            }
        } catch(e) {
            return just('oops, that wasn\'t valid math');
        }
    }
    // TODO: "deerhunter review"
    if ((m = input.match(/review of (.+)/)) ||
        (m = input.match(/tell me about (.+)/)) ||
        (m = input.match(/what do you think (?:of|about) (.+)/)) ||
        (m = input.match(/(?:how's|how is) (.+)/))) {
        const [, what] = m;
        return lookupThing(what)
            .flatMap(entities => {
                // FIXME: filter reviewable entities (album, film, book)
                // FIXME: pick best/first?
                // console.log(entities)
                const bestEntity = entities[0]
                // TODO: filter if in headline?
                if (bestEntity) {
                    let extraTagFilter = {
                        film: ['film/film'],
                        album: ['music/music'],
                        book: ['books/books']
                    }[bestEntity.kind] || [];
                    return findContent({
                        tag: ['tone/reviews'].concat(extraTagFilter).join(','),
                        q: quote(entities[0].name),
                        'show-fields': 'starRating'
                    });
                } else {
                    // ???
                    return justThrow('XXX');
                }
            }).map(response => {
                const contentList = response.results;
                const bestResult = contentList[0]
                if (bestResult) {
                    console.log(bestResult)
                    const {webTitle, webUrl, fields} = bestResult;
                    const {starRating} = fields || {};
                    const rating = starRating ? `${starRating}/5 ` : '';
                    const title = webTitle.replace(/( review)? [-–—]/, ' -');
                    const text = rating + title;
                    return twitterLength(text, webUrl);
                } else {
                    // FIXME: nothing found
                    return 'sorry, I couldn\'t find anything for you'
                }
            })
        // TODO: recover
    }
    if ((m = input.match(/an? (?:(.+) )?recipe with (.+)/))) {
        const [, author, ingredientsString] = m;
        const ingredients = ingredientsString.split(/(?:, +| +and +)/);
        const contributorsReq = author ?
              findContributors(author).map(resp => resp.results) :
              just([]);
        return contributorsReq
            .flatMap(contributors => {
                const bestContributor = contributors[0]
                const extraTagFilter = bestContributor ? [bestContributor.id] : [];
                return findContent({
                    tag: ['tone/recipes'].concat(extraTagFilter).join(','),
                    q: ingredients.map(quote).join(' AND ')
                });
            }).map(response => {
                const contentList = response.results;
                const bestResult = contentList[0]
                if (bestResult) {
                    const {webTitle, webUrl} = bestResult;
                    return twitterLength(webTitle, webUrl);
                } else {
                    // FIXME: nothing found
                    return `I'm afraid I didn't find any matching recipe`;
                }
            })
        // TODO: recover
    }
    if ((m = input.match(/(?:what's|what is) (.+)/))) {
        const [, concept] = m;
        return explainConcept(concept);
    }
    if ((m = input.match(/(?:who's|who is) (.+)/))) {
        const [, who] = m;
        return explainPerson(who);
    }

    if ((m = input.match(/(?:follow|subscribe to) (.+)/))) {
        const [, subject] = m;
        // TODO: parse subject, record in storage, listen to CAPI feed, post on match
        return just(`following ${subject} isn't supported just yet, I'm afraid`);
    }
    // TODO: last article/opinion piece by
    // TODO: give me something funny, sad
    // TODO: how many, facts
    // TODO: follow, subscribe

    // TODO: here for fun or business? more browsing

    // TODO: spontaneous: reply to tweet about X, Y
    // TODO: spontaneous: tweet if following @artist

    return just('sorry, I didn\'t get that');
}

function choose(options) {
    const randIndex = Math.floor(Math.random() * options.length);
    return options[randIndex];
}


function byteCount(s) {
    return encodeURI(s).split(/%..|./).length - 1;
}

function ellipsise(text, maxLen) {
    if (byteCount(text) <= maxLen) {
        return text;
    } else {
        // Hacky way to cut off enough utf-8 chars, since slice doesn't know utf-8
        const brutalUtf8Diff = byteCount(text) - text.length;
        // FIXME: cut whitespace, not words
        const ellipsisLen = byteCount('…');
        const maxText = text.slice(0, maxLen - ellipsisLen - brutalUtf8Diff);
        return `${maxText}…`;
    }
}

const TWEET_LENGTH = 140;
const URI_LENGTH = 22;
const MAX_HANDLE_LENGTH = 15;
const AVAILABLE_LENGTH = TWEET_LENGTH - MAX_HANDLE_LENGTH - 1 /* space */;

function twitterLength(text, uri) {
    if (uri) {
        const maxTextLen = AVAILABLE_LENGTH - URI_LENGTH - 1;
        const abbrevText = ellipsise(text, maxTextLen);
        return `${abbrevText} ${uri}`;
    } else {
        return ellipsise(text, AVAILABLE_LENGTH);
    }
}


function explainConcept(concept) {
    // TODO: lookup in concept store
    if (concept.match(/daesh/i)) {
        return just('Daesh is a derogatory appelation for ISIS, from the Arabic words Daes, "one who crushes something underfoot", and Dahes, "one who sows discord".');
    } else {
        return just('sorry I don\'t know');
    }
}

function explainPerson(person) {
    // TODO: lookup in people store
    if (person.match(/bernie sanders/i)) {
        return just('Bernard Sanders is an American Democrat and Senator from Vermont, candidate in the 2016 US election');
    } if (person.match(/leading republican candidate/i)) {
        return just('Donald Trump, by 14 points, I\'m afraid');
    } else {
        return just('sorry I don\'t know');
    }
}


import xml2js from 'xml2js';

function rxParseXml(xmlString) {
    return Rx.Observable.create(observer => {
        xml2js.parseString(xmlString, (err, data) => {
            if (err) {
                observer.onError(data);
            } else {
                observer.onNext(data);
            }
            observer.onCompleted();
        });
    });
}

const DBPEDIA_SPARQL_URI = 'http://live.dbpedia.org/sparql';

// function lookupPeople(people) {
//     const normalisedPeople = escapeDoubleQuote(people.toLowerCase());
//     return rxRequest({
//         uri: DBPEDIA_SPARQL_URI,
//         qs: {
//             query: `
// PREFIX dbo: <http://dbpedia.org/ontology/>
// PREFIX dbp: <http://dbpedia.org/property/>

// SELECT DISTINCT ?people ?type
// WHERE {
//   ?people dbp:name "${normalisedPeople}"@en.
//   ?people a ?type.
//   { ?people a dbo:Band } UNION
//   { ?people a dbo:MusicalArtist } UNION
//   { ?people a dbo:Writer }.
// }
// LIMIT 10`,
//             // FIXME: director?
//             format: 'json'
//         }
//     }).map(response => JSON.parse(response.body).results.bindings);
// }


const r = (pattern, flags = 'i') => new RegExp(pattern, flags);
const gQualifier = '(last|latest|recent|new|best|first)';
const gRelator = '(by|from|of|with|starring|featuring)';
const gThingType = '(film|movie|album|release|book|novel)';

function capitalise(str) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
}

function normalisedKind(thingType) {
    return {
        film:    'film',
        movie:   'film',
        album:   'album',
        release: 'album',
        book:    'book',
        novel:   'book'
    }[thingType];
}

function normalisedRelation(rel) {
    return {
        by:        'by',
        from:      'by',
        of:        'by',
        with:      'with',
        starring:  'with',
        featuring: 'with'
    }[rel];
}

function parseThing(thing) {
    let m;
    // TODO: use and pass qualifier
    // TODO: match with, starring, etc
    if ((m = thing.match(r(`the ${gQualifier} ${gThingType} ${gRelator} (.+)`)))) {
        return {
            name: m[4],
            relation: normalisedRelation(m[3]),
            kind: normalisedKind(m[2])
        };
    } else if ((m = thing.match(r(`the ${gQualifier} (.+) ${gThingType}`)))) {
        return {
            name: m[2],
            relation: 'by',
            // TODO: ambiguous relation?
            kind: normalisedKind(m[3])
        };
    } else if ((m = thing.match(r(`(.+)['’]s? ${gQualifier}? ${gThingType}`)))) {
        return {
            name: m[1],
            relation: 'by',
            // TODO: ambiguous relation?
            kind: normalisedKind(m[3])
        };
    } else {
        return {
            name: thing,
            relation: 'is'
            // kind not known
        };
    }
}

function lookupThing(thing) {
    const parsedThing = parseThing(thing);
    const normalisedName = escapeDoubleQuote(parsedThing.name.toLowerCase());
    let relClause;
    if (parsedThing.relation === 'is') {
        relClause = 'FILTER (sameTerm(?entity, ?thing))';
    } else if (parsedThing.relation === 'by') {
        let relation;
        if (parsedThing.kind === 'film') {
            relation = 'dbo:director';
        } else if (parsedThing.kind === 'album') {
            relation = 'dbo:artist';
        } else if (parsedThing.kind === 'book') {
            relation = 'dbo:author';
        } else {
            // should not reach
            relation = 'dbo:creator';
        }
        relClause = `?thing ${relation} ?entity`;
    } else if (parsedThing.relation === 'with') {
        let relation;
        if (parsedThing.kind === 'film') {
            relation = 'dbo:starring';
        } else if (parsedThing.kind === 'album') {
            relation = 'dbo:artist';
        } else if (parsedThing.kind === 'book') {
            // weird, not expected
            relation = 'dbo:author';
        } else {
            // should not reach
            relation = 'dbo:creator';
        }
        relClause = `?thing ${relation} ?entity`;
    }
    const typeClause = parsedThing.kind ?
          `{ ?thing a dbo:${capitalise(parsedThing.kind)} }` :
          `{ ?thing a dbo:Film } UNION
           { ?thing a dbo:Album } UNION
           { ?thing a dbo:Book }`;
    const query = `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT DISTINCT ?name ?thing ?type
WHERE {
  { ?entity dbp:name ?name } UNION { ?entity foaf:name ?name }.
  ?thing a ?type.
  ${typeClause}.
  ${relClause}.
  FILTER (lcase(str(?name)) = "${normalisedName}").
}
LIMIT 30`;
    return rxRequest({
        uri: DBPEDIA_SPARQL_URI,
        qs: {
            query: query,
            format: 'json'
        }
    }).map(response => {
        const rawResults = JSON.parse(response.body).results.bindings;
        const results = rawResults.map(result => {
            return {
                name: result.name.value,
                uri:  result.thing.value,
                type: result.type.value
            };
        });

        // group by uri, aggregate type into array
        return results.reduce((acc, result) => {
            if (! acc.some(r => r.uri == result.uri)) {
                return acc.concat({
                    name: result.name,
                    uri: result.uri,
                    types: [result.type]
                });
            } else {
                return acc.map(r => {
                    if (r.uri == result.uri) {
                        return {
                            name:  r.name,
                            uri:   r.uri,
                            types: r.types.concat(result.type)
                        };
                    } else {
                        return r;
                    }
                });
            }
        }, []).map(result => {
            return {
                name:  result.name,
                uri:   result.uri,
                types: result.types,
                kind:  result.types.indexOf('http://dbpedia.org/ontology/Film') !== -1 ? 'film' :
                    result.types.indexOf('http://dbpedia.org/ontology/Album') !== -1 ? 'album' :
                    result.types.indexOf('http://dbpedia.org/ontology/Book') !== -1 ? 'book' : undefined
            };
        });
    });
}

function escapeDoubleQuote(str) {
    return str.replace(/"/g, '%22');
}

function quote(str) {
    return `"${str}"`;
}

// function lookup(thing) {
//     return rxRequest({
//         uri: 'http://lookup.dbpedia.org/api/search.asmx/KeywordSearch',
//         qs: {
//             // QueryClass: 'place',
//             QueryClass: 'film',
//             QueryString: thing
//         }
//     }).
//         map(response => response.body).
//         flatMap(rxParseXml).
//         map(resp => {
//             const results = resp.ArrayOfResult.Result || [];
//             return results.map(result => {
//                 const classes = result.Classes[0].Class || [];
//                 return {
//                     title: result.Label[0],
//                     description: result.Description[0].trim(),
//                     classes: classes.map(klass => {
//                         return {
//                             title: klass.Label[0],
//                             uri: klass.URI[0]
//                         };
//                     })
//                 };
//             });
//         });
// }



import {readConfig} from './conf';

const config = readConfig();

const CAPI_API_KEY = config.capiApiKey;
const CAPI_BASE_URI = config.capiBaseUri;

function findContent(params) {
    return rxRequest({
        uri: `${CAPI_BASE_URI}/search`,
        qs: extend({
            'api-key': CAPI_API_KEY,
            limit: 10
        }, params)
    }).map(response => JSON.parse(response.body).response);
}

function findContributors(name) {
    return rxRequest({
        uri: `${CAPI_BASE_URI}/tags`,
        qs: extend({
            'api-key': CAPI_API_KEY,
            type: 'contributor',
            q: quote(name),
            limit: 3
            // FIXME: if multiple, find most popular..?
        })
    }).map(response => JSON.parse(response.body).response);
}



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
