import {respond} from './intelligence';

function test(input) {
    const response = respond(input);
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
test("what do you think about the last film with george clooney");
test("how is the last film with george clooney");
test("do you have an ottolenghi recipe with lamb and pomegranate");
test("do you have a nigel slater recipe with spring onion");
test("do you have a recipe with savoy cabbage");
test("do you have a miers recipe with prawns and chilli?");
test("who is bernie sanders?");
test("what is daesh?");
test("uh");
