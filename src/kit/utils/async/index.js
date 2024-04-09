const asyncIterWithCallback = async function* (
    iter,
    callback = async (item, index) => {
    },
    counter = 0
) {
    if (!iter?.length) {
        return null;
    }

    const item = iter[counter];

    yield item;

    try {
        await callback(item, counter);
    } catch (e) {
        console.log(e);
    }

    counter++;

    if (counter < iter?.length) {
        for await (const item of asyncIterWithCallback(iter, callback, counter)) {
            yield item;
        }
    } else {
        return null;
    }
};

const asyncIter2Array = async (
    iter,
    callback = (async (item, index) => item)
) => {
    const _return = [];
    const _isIterAsyncGenerator = _isAsyncGenerator(iter)
    let i = 0
    for await (
        const _ of (
        _isIterAsyncGenerator ?
            iter :
            asyncIterWithCallback(
                Array.from(iter),
                async (_, j) => {
                    _return.push(await callback(_, j));
                }
            )
    )) {
        if(_isIterAsyncGenerator) {
            _return.push(await callback(_, i++))
        }
    }
    return _return;
};

const _isAsyncFunction = (func) => Object.getPrototypeOf(async function () {
}).isPrototypeOf(func)

const _isAsyncGenerator = (obj) => {
    if (obj == null || typeof obj !== 'object') {
        return false;
    }

    return typeof obj[Symbol.asyncIterator] === 'function';
}

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const wrapAsync = (target) => {
    const promise = Promise.resolve(target)
    return new Proxy(new Function(), {
        get(_, prop, reciever) {
            if (
                !(
                    [
                        'string',
                        'number',
                        'bigint',
                        'boolean',
                        // 'function',
                        // 'object',
                        'symbol'
                    ].includes(
                        typeof target[prop]
                    )
                )
            ) {
                return (
                    ['then', 'catch', 'finally'].includes(prop) ?
                        (...args) => wrapAsync(promise[prop](...args))
                        : wrapAsync(
                            promise.then(
                                (_) => {
                                    return _[prop]
                                }
                            )
                        )
                )
            }
            return Reflect.get(target, prop, reciever)
        },
        apply(_, thisArg, args) {
            return wrapAsync(
                promise.then(
                    async target => {
                        return Reflect.apply(
                            target ||
                            (new Function()),
                            thisArg,
                            args
                        )
                    }
                )
            )
        },
    })
}

exports.asyncIterWithCallback = asyncIterWithCallback
exports.asyncIter2Array = asyncIter2Array
exports.sleep = sleep
exports.wrapAsync = wrapAsync