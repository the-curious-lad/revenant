#include <iostream>

using namespace std;

int main() {
    int x;
    cin >> x;
    while (true) {
        x = (x + 1) % 1000;
    }
    return 0;
}
