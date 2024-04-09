// const diff = (a, b) => [
//     a.filter((item) => !b.includes(item)),
//     b.filter((item) => !a.includes(item)),
// ];
const _ = require("lodash");
const diff = (oldArray, newArray) => [
    _.differenceWith(oldArray, newArray, _.isEqual),
    _.intersectionWith(oldArray, newArray, _.isEqual),
    _.differenceWith(newArray, oldArray, _.isEqual)
]

const tandemIter = function* (arr) {
    let previousItem;
    for (const currentItem of arr) {
        yield [previousItem, currentItem];
        previousItem = currentItem;
    }
}

const uniquify = (arr, iteratee='id') => _(arr).groupBy(iteratee)
    .map((group) => _.last(group))
    .value()

exports.diff = diff
exports.tandemIter = tandemIter
exports.uniquify = uniquify