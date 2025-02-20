import assert from "assert";
import TimedCache from "../../common/cache/TimedCache.js";
import sleep from "../../common/sleep.js";

export default async function() {

    await test3();

    // await Promise.all([
    //     test1(),
    //     test2(),
    //     test3()
    // ]);
}

async function test1() {
    const c1 = new TimedCache(1000);

    const firstV1 = "v1";

    const cc1 = c1.getOrCreate("a1", 0, () => firstV1, 2000);

    await sleep(1000);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());


    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());

    const firstV2 = "v2";

    const cc2 = c1.getOrCreate("a1", 0, () => firstV2);

    assert.equal(cc2, firstV1);
    assert.equal(cc2, cc1);

    await sleep(1000);

    const firstV3 = "v3";

    const cc3 = c1.getOrCreate("a1", 0, () => firstV3);
    assert.equal(cc3, cc1);

    await sleep(2000);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());


    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());

    const firstV4 = "v4";

    const cc4 = c1.getOrCreate("a1", 0, () => firstV4);

    assert.equal(cc4, firstV4);
}


async function test2() {
    const c1 = new TimedCache(1000);

    const firstV1 = "v1";

    const cc1 = c1.getOrCreate("a1", 0, () => firstV1, 2000);
    const cd1 = c1.getOrCreate("a2", 0, () => firstV1, 1000);

    await sleep(1000);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());


    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());

    const firstV2 = "v2";

    const cc2 = c1.getOrCreate("a1", 0, () => firstV2);
    const cd2 = c1.getOrCreate("a2", 0, () => firstV2);

    assert.equal(cc2, firstV1);
    assert.equal(cc2, cc1);

    assert.notEqual(cd2, cd1);
    assert.equal(cd2, firstV2);

    await sleep(1000);

    const firstV3 = "v3";

    const cc3 = c1.getOrCreate("a1", 0, () => firstV3);
    assert.equal(cc3, cc1);

    await sleep(2000);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());


    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    c1.clearExpired(Date.now());

    const firstV4 = "v4";

    const cc4 = c1.getOrCreate("a1", 0, () => firstV4);

    assert.equal(cc4, firstV4);
}

async function  test3() {
    const c1 = new TimedCache(1000);

    c1.getOrCreate("a1", 0, () => "a1");
    c1.getOrCreate("a2", 0, () => "a2");

    assert.equal("2,0,0", c1.sizes);

    await sleep(1000);
    assert.equal("0,2,0", c1.sizes);

    await sleep(1000);
    assert.equal("0,0,2", c1.sizes);

    c1.getOrCreate("a1", 0, () => "a1");
    assert.equal("1,0,1", c1.sizes);

    await sleep(1000);
    c1.getOrCreate("a2", 0, () => "a1");
    assert.equal("1,1,0", c1.sizes);

    await sleep(1000);
    assert.equal("0,1,1", c1.sizes);

    await sleep(1000);
    assert.equal("0,0,1", c1.sizes);

    c1.getOrCreate("a2", 0, () => "a1");
    assert.equal("1,0,0", c1.sizes);
    c1.getOrCreate("a2", 0, () => "a1");
    await sleep(1000);
    assert.equal("0,1,0", c1.sizes);

    c1.getOrCreate("a2", 0, () => "a1");
    assert.equal("1,0,0", c1.sizes);

}