/* eslint-disable no-console */
import assert from "assert";
import ObjectPool from "../../common/ObjectPool.js";
import sleep from "../../common/sleep.js";


export default async function () {
    let id = 1;
    const logs = [] as string[];
    try {
        const pool = new ObjectPool({
            asyncFactory: async () => {
                await sleep(1);
                return Promise.resolve({ id: id++, toString() { return `item-${this.id}`; } });
            },
            subscribeForRemoval: (po, clear) => void 0,
            destroy(item) {
                return Promise.resolve();
            },
            maxSize: 5,
            poolSize: 2,
            maxWait: 5000,
            logger: (t) => logs.push(t)
        });

        const c1 = await pool.acquire();
        const c2 = await pool.acquire();

        assert.equal(2, c2.id);

        assert.notStrictEqual(c1, c2);

        await c1[Symbol.asyncDisposable]();

        assert.equal(pool.freeSize, 1);

        const c3 = await pool.acquire();
        assert.strictEqual(c1, c3);
        assert.notStrictEqual(c2, c3);
        assert.strictEqual(pool.freeSize, 0);

        const c4 = await pool.acquire();
        assert.notStrictEqual(c4, c1);
        assert.notStrictEqual(c4, c2);

        assert.strictEqual(pool.currentSize, 3);

        await c4[Symbol.asyncDisposable]();
        await c2[Symbol.asyncDisposable]();

        assert.equal(pool.currentSize, 3);

        assert.equal(pool.freeSize, 2);

        await pool.acquire();
        await pool.acquire();
        await pool.acquire();
        const last = await pool.acquire();
        let lastError;
        try {
            await pool.acquire();
        } catch (error) {
            lastError = error;
        }
        if (!lastError) {
            assert.fail("Failed");
        }

        // free last after few milliseconds
        setTimeout(() => {
            last[Symbol.asyncDisposable]().catch(console.error);
        }, 10);

        // this should not fail
        await pool.acquire();
    } finally {
        console.log(logs.join("\n"));
    }
}