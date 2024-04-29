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

const clean = (obj, {preserveNull = true, preserveEmpty = true}={}) => {
    if (_.isObject(obj) && !_.isArray(obj)) {
        const cleanedObject = _.pickBy(
            obj,
            (value) => {
                if (preserveNull) {
                    return !_.isUndefined(value)
                }
                return !(_.isUndefined(value) || _.isNull(value))
            }
        )

        for (const key in cleanedObject) {
            const cleanedValue = clean(cleanedObject[key], {preserveNull, preserveEmpty})
            cleanedObject[key] = cleanedValue

            if (_.isObject(cleanedValue) && _.isEmpty(cleanedValue) && !preserveEmpty) {
                delete cleanedObject[key];
            }
        }

        return cleanedObject

    } else if (_.isArray(obj)) {

        return _.compact(
            _.map(obj, (obj) => clean(obj, {preserveNull, preserveEmpty}))
        ).filter(
            (a) =>
                _.isObject(a) && !preserveEmpty ?
                    !_.isEmpty(a) : a
        )

    } else {
        return obj
    }
}

const merge = (...sources) => _.merge({}, ...sources)

exports.diff = diff
exports.clean = clean
exports.dynamic = clean
exports.tandemIter = tandemIter
exports.uniquify = uniquify
exports.merge = merge