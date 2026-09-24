
export default class Queue<T> {

    head = 0;
    tail = 0;

    store: Map<any,any> = new Map();

    peek() {
        return this.store.get(this.head);
    }

    public enqueue(item: T) {
        this.store.set(this.tail, item);
        this.tail++;
    }

    public dequeue() {
        const { head, tail } = this;
        const size = tail - head;
        if (size <= 0) {
            return void 0;
        }            
        const item = this.store.get(head);
        this.store.delete(head);
        this.head++;
        if (this.head === this.tail) {
            this.head = 0;
            this.tail = 0;
        }
        return item;
    }

}
