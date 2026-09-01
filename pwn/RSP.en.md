---
title: "RSP"
date: "2025-07-14"
tags: ["picoCTF", "string injection", "input validation"]
---

The challenge gives us the code of a binary. Looking at it, we can see it is a game of rock, paper, scissors.

Digging into the program we can find the following:

```c
if (strstr(player_turn, loses[computer_turn])) {
    puts("You win! Play again?");
    return true;
  } else {
    puts("Seems like you didn't win this time. Play again?");
    return false;
  }
```

`strstr` checks whether the string in the second argument is contained in the first one. So it checks whether the move that makes the machine lose is present in the player input.

That makes sense, but it is not really doing a strict check like "input == rock". It just looks for the string "rock" inside the input. That means if we type "rock\_", it would also be detected as valid.

Because of this, if we use the following payload we will always win, since it contains every string that makes the machine lose:

```
rockpaperscissors
```

Example run:

```c
Welcome challenger to the game of Rock, Paper, Scissors
For anyone that beats me 5 times in a row, I will offer up a flag I found
Are you ready?
Type '1' to play a game
Type '2' to exit the program
1
1

Please make your selection (rock/paper/scissors):
rockpaperscissors
rockpaperscissors
You played: rockpaperscissors
The computer played: rock // busca "paper" en nuestra cadena (rockPAPERscissors)
You win! Play again?
```

If we win 5 times in a row, the program gives us the flag.
