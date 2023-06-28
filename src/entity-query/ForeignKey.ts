export default function ForeignKey(name: string) {
    return (target: any, key: string): any => {
        return {
            get() {

            },
            enumerable: true,
            configurable: true
        }
    };
}