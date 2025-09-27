# Nocturnal

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FDTXvhbrSVu6BjRQEMpUm%2FNocturnal.png?alt=media&#x26;token=354c25bd-06a6-4ee9-ad53-3eb2abd0965c" alt=""><figcaption></figcaption></figure>

## Enumeración

<pre class="language-bash"><code class="lang-bash"><strong>PORT   STATE SERVICE VERSION
</strong>22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 20:26:88:70:08:51:ee:de:3a:a6:20:41:87:96:25:17 (RSA)
|   256 4f:80:05:33:a6:d4:22:64:e9:ed:14:e3:12:bc:96:f1 (ECDSA)
|_  256 d9:88:1f:68:43:8e:d4:2a:52:fc:f0:66:d4:b9:ee:6b (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Did not follow redirect to http://nocturnal.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
</code></pre>

### Web

Al meternos en la web podemos ver que se trata de una web de subida de archivos.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FUnIJ2m0hXvivWDXOgPvQ%2Fimage.png?alt=media&#x26;token=c5ce8369-e5f8-42fe-acfc-8ebf0be33055" alt=""><figcaption></figcaption></figure>

Vemos que podemos registrarnos o logearnos. Si intentamos crearnos una cuenta vemos que nos deja y accedemos a la parte donde podemos subir archivos

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F1GmlEPJqGv5E2AaiIjwr%2Fimage.png?alt=media&#x26;token=bc16c39d-1f62-4d52-a7a5-a104b40c77a0" alt=""><figcaption></figcaption></figure>

La web solo permite varios tipos de archivos y solo se fija en como acaba el nombre del archivo. En este caso la infiltración no va por ese camino.&#x20;

Si nos ponemos a analizar las peticiones que se realizan podemos ver como la peticion de abrir el archivo que hemos subidos tiene la siguiente estructura:\\

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FlEofwN2hDO87iSbYRBhI%2Fimage.png?alt=media&#x26;token=7d32e133-b6cf-469a-9a27-a94680150298" alt=""><figcaption></figcaption></figure>

Como podemos ver, le podemos pasar un username, entonces podemos intentar hacer enumeración de usuarios con fuera bruta.&#x20;

Si le pasamos un usuario invalido y en file ponemos simplemente .pdf, si el usuario no existe nos saltará `User not found.`  en la respuesta, con lo cual ya tenemos una clara de enumerar usuarios simplemente filtrando cuando no salga ese mensaje.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FXOMMr9m0cBX2n6luTQBp%2Fimage.png?alt=media&#x26;token=1f3cecf1-bbbc-450b-abdd-d4ed5f8deda2" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F2dfkv6Qkx7avnTEaFkEW%2Fimage.png?alt=media&#x26;token=6a5a29f4-872f-459b-83f8-d1179cdbe7c7" alt=""><figcaption></figcaption></figure>

Una vez aplicado el filtro podemos ver que hemos enumerado correctamente 3 usuarios

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FBZ7WgjEtmkWa8yKe135v%2Fimage.png?alt=media&#x26;token=edae788f-6ce9-4603-8ace-de6df7fd3fa9" alt=""><figcaption></figcaption></figure>

Si nos fijamos, si pasamos un usuario ajeno al nuestro en el parametro username tendremos acceso a los archivos que tiene subidos. Vamos a comprobar si alguno de los usuarios enumerados tiene algo interesante:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FIxFQACvGuYEscOpzYimp%2Fimage.png?alt=media&#x26;token=0e6887e4-d97d-4c54-8ea0-fe2bafdb9cc3" alt=""><figcaption></figcaption></figure>

El usuario `amanda` tiene un archivo .odt y dentro podemos encontrar credenciales.

Si entramos a la cuenta de amanda en la web con sus credenciales podremos ver un nuevo apartado en donde podremos entrar a un panel de admin:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FjGZv64cOBUGajSJp4ggK%2Fimage.png?alt=media&#x26;token=e01e8916-ded1-4b0d-8180-880a219315ad" alt=""><figcaption></figcaption></figure>

Al entrar podremos ver el código de como esta montada la web por detrás.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FgzrUwx8SkxSzUuyQrk5s%2Fimage.png?alt=media&#x26;token=dd21ef53-ae67-454c-a379-abe498581312" alt=""><figcaption></figcaption></figure>

También podremos ver un apartado en el que podemos crear backups

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FIMr4E5f2b9moAviJtHb4%2Fimage.png?alt=media&#x26;token=26806716-9253-4d2b-9228-31e2f89fe8c5" alt=""><figcaption></figcaption></figure>

Si nos ponemos a analizar como está codeada la pagina por detrás podremos ver que en la creación de backups se le puede pasar un parámetro contraseña, el cual se introduce tal cual en el comando del binario `zip` . Esto sugiere que podemos tratar de injectar un comando malicioso allí

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F4RaJE7WyxgC6u2GnZxc0%2Fimage.png?alt=media&#x26;token=e0e3874d-ab11-4682-9f25-e43db0790dec" alt=""><figcaption></figcaption></figure>

Si analizamos la peticiond e crear backup podemos ver que, efectivamente, le podemos pasar un parametro `password` .

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F238XFj1vIAOOdYp7f3aE%2Fimage.png?alt=media&#x26;token=c51f7978-8e8a-4e3c-a047-a46773850816" alt=""><figcaption></figcaption></figure>

Como podemos ver en el codigo, nuestra password está entre comillas con lo cual podemos poner una doble comilla al principio a ver que pasa.

Vamos a intentar introducir `"whoami`

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F2byhhZjuCQ55ZNwu7Hcy%2Fimage.png?alt=media&#x26;token=66dae686-6e51-41f2-8dd8-c175ee14f50a" alt=""><figcaption></figcaption></figure>

Como podemos ver hemos injectado correctamente un comando pero no lo acaba de tragat del todo ya que sigue ejecutando lo que viene despues de nuestra injección, lo que hace que falle. Para hacer que esto no suceda podemos usar varias tácticas para ver si alguna funciona, la siguiente pagina ofrece muchas ideas de como lograr esto:

[Link](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Command%20Injection)

Al probar varios métodos, el que me funcionó es usar el simbolo `<` para hacer que la shell lea el contenido especificado y también he usado **`%09`** ya que lo detecta como si fuera un espacio.

Ejemplo de injección: `cat%09<%09/etc/passwd`&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FQlqRuBJPEuS2ZzRrjmWM%2Fimage.png?alt=media&#x26;token=4a12561a-68b4-43a4-ad47-c055787564e5" alt=""><figcaption></figcaption></figure>

Ahora que podemos ejecutar comandos podemos hacer comandos como `ls` y `cd` para hacer un reconocimiento para ver si hay algun archivo sensible en algun directorio.

Al enumerar podremos encontrar un archivo `nocturnal_database.db` el cual podemos ver su contenido con el comando strings

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FPXLhIAgHkVBjsTONIo5f%2Fimage.png?alt=media&#x26;token=bb6f1827-7566-4476-ab3f-1bd084ecd3ff" alt=""><figcaption></figcaption></figure>

El archivo nos da hashes que podemo intentar crackear offline con herramientas como john

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FksxXSAFDBkIykpk8282Z%2Fimage.png?alt=media&#x26;token=71cc2ce1-c5ec-4b0a-a78a-525c9885c78a" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FxmpjAI61IjyEuOwKfNpI%2Fimage.png?alt=media&#x26;token=70fa8474-d5ba-4df0-a640-9dd6dd114c9a" alt=""><figcaption></figcaption></figure>

John de normal no me ha funcionado y he tenido que especificarle con el parámetro `--format` que era un MD5.

Ahora que tenemos un usuario y contraseña vamos a intentar logearnos contra el ssh

Y efectivamente ya tenemos una shell como el usuario tobias

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FUoIsBduQN2yZXxfvjOpV%2Fimage.png?alt=media&#x26;token=a3739849-e3f4-4856-857b-3c1ff89846d4" alt=""><figcaption></figcaption></figure>

## Escalada

Una vez estamos como el usuario tobias, si buscamos con `netstat -tulnp` puertos en escucha en nuestro equipo podremos ver como el puerto 8080 está en escucha, esto nos da a entender que hay un servicio web corriendo solamente accesible desde la misma maquina. Para acceder a este sitio web podemos usar herramientas como Chisel y Proxychains pero para no complicarnos vamos a simplemente usar `ssh tobias@nocturnal.htb -L 9000:127.0.0.1:8080` .

Al poner ese comando estaremos haciendo un port forwarding del puerto 8080, que podremos ver en nuestro equipo en el puerto 9000.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FAn3krlYZmcvTwDwXlKud%2Fimage.png?alt=media&#x26;token=0ee46c1d-73c5-4927-bc66-8464cfac7197" alt=""><figcaption></figcaption></figure>

Al entrar a la web veremos una pagina web, la cual, tras probar con usuarios tipicos y contraseñas que ya conocemos podemos ver que la combinacion de `admin` y `slowmotionapocalypse` funciona.

Al entrar podremos ver un panel administrativo

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FKLvEcIp9R0fal0VIWe0H%2Fimage.png?alt=media&#x26;token=6e2e4a07-1fe7-47f1-af01-724705a113bf" alt=""><figcaption></figcaption></figure>

Si vamos al apartado help podremos enumerar la versión de ISPCONFIG. Al buscar en internet podremos ver que es una versión vulnerable y podremos descargar un exploit para aprovecharnos de una vulnerabilidad en donde un parametro por post no tiene sanitización y se puede manipular para ejecutar codigo php al gusto.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FypTOjVbQIGj4fvlAvZia%2Fimage.png?alt=media&#x26;token=a18d0605-62ae-4223-a692-63c48ec65116" alt=""><figcaption></figcaption></figure>

Y así tendremos acceso ya a `root.txt`&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FkrjomgAuBWmslOupjKu1%2Fimage.png?alt=media&#x26;token=0075970b-fc7d-4430-be3b-6044cd5bf87d" alt=""><figcaption></figcaption></figure>

Y así la maquina estará Pwned! Gracias por leer!
