---
title: "two-sum"
date: "2025-07-15"
tags: ["picoCTF", "integer overflow"]
---

The challenge gives us the C source of a program:

```c
#include <stdio.h>
#include <stdlib.h>

static int addIntOvf(int result, int a, int b) {
    result = a + b;
    if(a > 0 && b > 0 && result < 0)
        return -1;
    if(a < 0 && b < 0 && result > 0)
        return -1;
    return 0;
}

int main() {
    int num1, num2, sum;
    FILE *flag;
    char c;

    printf("n1 > n1 + n2 OR n2 > n1 + n2 \n");
    fflush(stdout);
    printf("What two positive numbers can make this possible: \n");
    fflush(stdout);
    
    if (scanf("%d", &num1) && scanf("%d", &num2)) {
        printf("You entered %d and %d\n", num1, num2);
        fflush(stdout);
        sum = num1 + num2;
        if (addIntOvf(sum, num1, num2) == 0) {
            printf("No overflow\n");
            fflush(stdout);
            exit(0);
        } else if (addIntOvf(sum, num1, num2) == -1) {
            printf("You have an integer overflow\n");
            fflush(stdout);
        }

        if (num1 > 0 || num2 > 0) {
            flag = fopen("flag.txt","r");
            if(flag == NULL){
                printf("flag not found: please run this on the server\n");
                fflush(stdout);
                exit(0);
            }
            char buf[60];
            fgets(buf, 59, flag);
            printf("YOUR FLAG IS: %s\n", buf);
            fflush(stdout);
            exit(0);
        }
    }
    return 0;
}
```

In short, what this code does is ask the user for two numbers. Then it checks whether there is an integer overflow, and if there is, it checks whether the two numbers entered are positive. If both conditions hold, it prints the flag.

To reach the part of the function that prints the flag, we have to meet two conditions:

* Cause an integer overflow.
* Both numbers we enter have to be positive.

If we try to cause an overflow by entering very large numbers, we will not necessarily get one. So we have to find another way.

Looking at the `addIntOvf` function:

```c
static int addIntOvf(int result, int a, int b) {
    result = a + b;
    if(a > 0 && b > 0 && result < 0)
        return -1;
    if(a < 0 && b < 0 && result > 0)
        return -1;
    return 0;
}
```

There is a check on each of the inputs, but not on the result itself. The parameters `a`, `b` and `result` are of type `int`.

The `int` type has a maximum value of `2,147,483,647`. So if the sum of the two numbers goes over that limit and neither one on its own goes over it (so the conditions do not catch us), we get to the part where the flag is printed.

We try with:

* First number: `2,147,483,647`
* Second number: `1`

```bash
nc saturn.picoctf.net 53064
n1 > n1 + n2 OR n2 > n1 + n2
What two positive numbers can make this possible:
2147483647
1
You entered 2147483647 and 1
You have an integer overflow
YOUR FLAG IS: picoCTF{SECRETO}
```

Flag obtained!
