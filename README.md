# nxn-config
loads config files in json or yaml format, and search them in a path list.
Supports : variables, external file inclusion, and path list search.

Config files are searched using a path list, usually : 
- environment directory : where variables and keys are stores, by environment, within client data directory
- client data : where configuration files are stored by client (for multi tenant applications), and also data stored on disk,
- root directory : where the index.js main file is stored. 

Configuration files can be organised as structured data, or as key:value pairs.

*Config format*
@nxn/config supports :
- JSON format,
- YAML format.

*Variables:*
Variables can be defined in the config file itsef :
ex.
$variables: 
  var1 :xxx
  var2: true
  var3: 
	a: true
	b: AAA

or loaded from another file 
$variables: $ref(.env_variables)

and used in the config:
ex.

$variables: $ref(.env_variables)

app1:
  path: ${var1}
  active: ${var3.c}

*Pipe filters* :
variables can be modified with "filters", to format them:
for example : ${name|id} transforms name variable into an id, replacing accents, blanks, etc.

Filters can be piped :
${name|id|base64} : transforms name into an id and then format it in base 64.

supported filters:
    id : 
    base64 : base 64,
    decode64 : decode Base 64,
    md5: md5 hash
    dateString: transform a date object into a string,
    timestamp: date to unix time
    date: transform to date format
    now: current date
    url_encode: URL encode
    trim: remove trailing blanks
    lower: lower case
    upper: upper case
    no_accents : remove accents in strings
    env: get a env variable
    argv: get main argv param, if variable is an integer


*Includes:*
another file can be referenced and loaded in the config file.
ex.

myServices: $ref(app/services)

nb. a YAML file can include another YAML file or a JSON.
Each file is loaded and evaluated before inserting its values in another file.
As such, an included file can define its own variables or include other files.
An included file can use variables that are replaced by its own variables, completed by its "parent" file variables.
