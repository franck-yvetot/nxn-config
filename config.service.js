const fs = require('fs');
let debug= console;
const yaml = require('js-yaml');
const mapper = require("./variables.service");

/**
 * 
 *  read a json or yaml config file from defined paths
 * 
 * */ 
class configSce 
{
    constructor() {
        this.app = null;
        this.config = {};
        this.dirPaths = [];
        this.env = '';
    }

    init(dirPaths) {
        this.dirPaths = dirPaths;
    }

    mapVariables(config,variables) {
        return mapper.mapConfig(config,variables,this);
    }

    loadVariables(path,dirPaths,env='') {
        this.variables = this.loadConfig(path,dirPaths);
    }

    applyVariables(config,variables,path) {
       
        if(variables)
        {
            config = this.mapVariables(config,variables);

            if(false && path)
                fs.writeFile(path+'_parsed.yml',yaml.safeDump(config),(err) => {
                    if (err) {
                        console.log(err);
                    }
                });
        }

        return config;
    }

    loadCleanConfig(path,dirPaths,variables=null) {
        let config = this.loadConfig(path,dirPaths,variables);
        if(config.$path)
            delete config.$path;

        if(config.$variables)
            delete config.$variables;

        return config;
    }

    loadConfig(path,dirPaths,variables=null) {
        var self = this;

        dirPaths =  dirPaths || this.dirPaths;
        let content = null;
        let config = null;
        let foundPath = path;
        const exts = ['','.json','.yml','.yaml'];

        // Read file
        if(dirPaths)
        {
            dirPaths.forEach(dir => {
                exts.forEach(ext=> {
                    const p = dir+'/'+path+ext;
                    if(!content && self.existsConfig(p)) {
                        content = self.readFileSync(p);
                        foundPath = p;
                    }                
                });
            });

            if(!this.dirPaths || !this.dirPaths.length)
                this.dirPaths = dirPaths;
        }
        
        if(!content)
            content = self.readFileSync(path);
        
		if(!content)
        {
            debug.error('boot with no config, missing file '+path);
            throw {message:"Missing file or config : "+path, code:400};
        }

        if(foundPath.endsWith("yaml") || foundPath.endsWith("yml"))
        {
            debug.log('YAML boot config : '+foundPath);
            try {
                config = yaml.safeLoad(content);                
            } catch (error) {
                debug.error('YAML error : '+error.message || error);
                throw error;
            }
        }
        else {
            debug.log('JSON boot config : '+foundPath);
            config = JSON.parse(content);
        }

        config.$path = foundPath;

        let $variables;
        if(config.$variables)
        {
            if(typeof config.$variables == "string")
            {
                // $ref()
                let res = this.mapVariables({variables:config.$variables},variables);
                $variables = res.variables;    
            }
            else
            {
                // inline list
                $variables = config.$variables;
            }

            // apply parent variables
        if(variables)
                $variables = this.mapVariables($variables,variables);
        }

        if(variables || $variables)
        {
            variables = variables || {};
            $variables = $variables || {}
            variables = {...variables,...$variables};

            config = this.mapVariables(config,variables);  

            if(config.$dump_config)
            {
                const dumpPath = foundPath+'_parsed.yml';
                debug.log("dump parsed config to "+dumpPath)
                this.saveConfig(dumpPath,config);
            }
        }

        return config;
    }

    saveConfig(path,config) {
        fs.writeFile(path,yaml.safeDump(config),(err) => {
                if (err) {
                    console.log(err);
                }
            });
    }

	// I/O
    existsConfig(path) {
        try {
            if (fs.existsSync(path))
                return true;
            else
                return false;
          } 
          catch(err) {
            return false;
        }
    }
 
    readFileSync(p) {
        try {
            if(p)
                return fs.readFileSync(p);
            else
            {
                debug.error("Read config file : empty path "+p);
                return null;
            }
        }
        catch(error) {
            debug.error("Error reading "+p);
            return null;
        }
    }

}

module.exports = new configSce();