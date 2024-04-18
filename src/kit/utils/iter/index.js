// const diff = (a, b) => [
//     a.filter((item) => !b.includes(item)),
//     b.filter((item) => !a.includes(item)),
// ];
const _ = require("lodash");
const diff = (arr1, arr2, iteratee) => {
    if (_.isString(iteratee) || _.isFunction(iteratee)) {
        const getKey = _.iteratee(iteratee);

        const indexedArr1 = _.groupBy(arr1, getKey);
        const indexedArr2 = _.groupBy(arr2, getKey);

        const deletedItems = [];
        const restItems = [];
        const newItems = [];
        const editedItems = [];

        _.forEach(indexedArr1, (group, key) => {
            const group2 = indexedArr2[key];

            if (_.isUndefined(group2)) {
                deletedItems.push(...group);
            } else {
                _.forEach(group, item => {
                    const foundItem = _.find(group2, item2 => _.isEqual(getKey(item), getKey(item2)));
                    if (_.isUndefined(foundItem)) {
                        deletedItems.push(item);
                    } else if (!_.isEqual(item, foundItem)) {
                        editedItems.push(foundItem);
                    } else {
                        restItems.push(item);
                    }
                });
            }
        });

        _.forEach(indexedArr2, (group, key) => {
            const group1 = indexedArr1[key];

            if (_.isUndefined(group1)) {
                newItems.push(...group);
            }
        });

        return [deletedItems, restItems, newItems, editedItems];
    } else {
        return [
            _.differenceWith(arr1, arr2, _.isEqual),
            _.intersectionWith(arr1, arr2, _.isEqual),
            _.differenceWith(arr2, arr1, _.isEqual)
        ];
    }
};

const tandemIter = function* (arr) {
    let previousItem;
    for (const currentItem of arr) {
        yield [previousItem, currentItem];
        previousItem = currentItem;
    }
}

const uniquify = (arr, iteratee = 'id') => _(arr).groupBy(iteratee)
    .map((group) => _.last(group))
    .value()

exports.diff = diff
exports.tandemIter = tandemIter
exports.uniquify = uniquify