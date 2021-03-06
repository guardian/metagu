import {readConfig} from './conf';
import {Intelligence} from './intelligence';
import {Memory} from './memory';
import {TagFollowers} from './follow';

const config = readConfig();

// TODO: memory.close() once all done
const memory = new Memory(config.redisUri, 'metagu');
const tagFollowers = new TagFollowers(memory);

const intelligence = new Intelligence(tagFollowers);


function test(input) {
    const response = intelligence.respond(input, 'theefer');
    response.subscribe(
        resp => {
            console.log(input);
            console.log(`>> ${resp}`);
        },
        error => {
            console.log(input);
            console.log(`!!!! ${error}`);
        },
        _ => {
            console.log();
        }
    );
}


// TODO: lookup authors/etc the user follows, notify of reviews, interview etc
// TODO: example of useful questions people ask
// TODO: all reviews of books by X, best first

test("hi!");
test("who are you?");
test("who created you?");
test("what is the time?");
test("2 + 2");
test("2 / 0");
test("-2 / 0");
test("--2 / 0");
test("give me a review of SPECTRE");
test("give me a review of SPECTRE please");
test("give me a review of the lobster");
test("give me a review of fading frontier");
test("give me a review of the peripheral");
// test("give me a review of the peripheral by william gibson");
test("give me a review of the last Chvrches album");
test("give me a review of the last film with Daniel Craig");
test("how is the latest film with daniel craig?");
test("what do you think about the last film with george clooney");
test("do you have an ottolenghi recipe with lamb and pomegranate");
test("do you have an ottolenghi recipe with beetroot and mackerel");
test("do you have a nigel slater recipe with spring onion");
test("do you have a recipe with savoy cabbage");
test("do you have a miers recipe with prawns and chilli?");
test("how do I make chocolate brownies?");
test("give me a recipe for paella.");
// test("give me a broccoli recipe");
test("can I have a recipe for lemon meringue pie please");
test("Can I see a recipe with fish?");
test("who is bernie sanders?");
test("what is daesh?");
test("uh");
test("subscribe to Stephen Collins cartoons");
test("follow stuff by Cory Doctorow");
test("let me know where there's a new andrew sparrow liveblog");
