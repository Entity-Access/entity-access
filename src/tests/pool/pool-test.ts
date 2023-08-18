/* eslint-disable no-console */
import assert from "assert";
import ObjectPool from "../../common/ObjectPool.js";
import sleep from "../../common/sleep.js";

let id = 1;

export default async function () {
    const logs = [] as string[];
    try {
        const pool = new ObjectPool({
            asyncFactory: async () => {
                await sleep(1);
                return Promise.resolve({ id: id++, toString() { return `item-${this.id}`; } });
            },
            subscribeForRemoval: (po, clear) => void 0,
            destroy(item) {
                return sleep(10);
            },
            maxSize: 5,
            poolSize: 2,
            maxWait: 5000,
            logger: (t) => logs.push(t)
        });

        const c1 = await pool.acquire();
        const c2 = await pool.acquire();

        assert.equal(2, c2.id);

        assert.notEqual(c1, c2);

        await c1[Symbol.asyncDisposable]();

        assert.equal(pool.freeSize, 1);

        const c3 = await pool.acquire();
        assert.equal(c1, c3);
        assert.notEqual(c2, c3);
        assert.equal(pool.freeSize, 0);

        const c4 = await pool.acquire();
        assert.notEqual(c4, c1);
        assert.notEqual(c4, c2);

        assert.equal(pool.currentSize, 3);

        await c4[Symbol.asyncDisposable]();
        logs.push(`c2 has disposable of type ${c2[Symbol.asyncDisposable]} with ${c2}`);
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