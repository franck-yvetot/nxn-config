const fs = require('fs');
let debug= console;
const yaml = require('js-yaml');
const { basename,dirname } = require('path');
const mapper = require("./variables.service");

/**
 * 
 *  read a json or yaml config file from defined paths
 * 
 * */ 
class ConfigSce 
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

    /**
     * 
     * @param {Record<string,any>} config 
     * @param {Record<string,any>} variables 
     * @param {string} curpath
     * @returns 
     */
    mapVariables(config,variables,curpath=null) {
        return mapper.mapConfig(config,variables,this,curpath);
    }

    loadVariables(path,dirPaths,env='',curpath=null) {
        this.variables = this.loadConfig(path,dirPaths,curpath);
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

    loadCleanConfig(path,dirPaths,variables=null,curPath=null) {
        try 
        {
            let config = this.loadConfig(path,dirPaths,variables,curPath);
            if(config.$path)
                delete config.$path;
    
            if(config.$variables)
                delete config.$variables;
    
            return config;            
        } 
        catch (error) 
        {
            throw error;
        }

    }

    loadConfig(path,dirPaths,variables=null,curPath=null) {
        var self = this;

        dirPaths =  dirPaths || [...this.dirPaths];
        dirPaths.push('./');
        if(curPath)
            dirPaths.push(curPath);

        dirPaths.push('');
        let content = null;
        let config = null;
        let foundPath = path;
        const exts = ['.yml','.json','','.yaml'];

        // Read file
        if(dirPaths)
        {
            dirPaths.forEach(dir => 
            {
                exts.forEach(ext => 
                {
                    const p = dir+'/'+path+ext;
                    if(!content && self.existsConfig(p)) 
                    {
                        content = self.readFileSync(p);
                        foundPath = p;
                        console.log("--- found : "+p);
                    }                
                });
            });

            if(!this.dirPaths || !this.dirPaths.length)
                this.dirPaths = dirPaths;
        }
        
        if(!content) 
        {
            //             content = self.readFileSync(path);

            dirPaths.forEach(dir => 
            {
                exts.forEach(ext => 
                {
                    const p = (dir+'/'+path+ext).replace(/\/+/g,'/');
                    debug.error("Tried : "+p);
                });
            });                    
        }
        
		if(!content)
        {
            debug.error('boot with no config, missing file '+path+" from "+curPath);
            let e = {message:"Missing file or config : "+path, code:400};
            throw e;
        }

        if(foundPath.endsWith("yaml") || foundPath.endsWith("yml"))
        {
            debug.log('YAML boot config : '+foundPath);
            try 
            {
                config = yaml.load(content);                
            } 
            catch (error) 
            {
                debug.error('YAML error in '+foundPath+" : "+error.message || error);
                throw error;
            }
        }
        else 
        {
            debug.log('JSON boot config : '+foundPath);
            config = JSON.parse(content);
        }

        config = config || {};
        config.$path = foundPath;            

        let curPath2 = this.$dir = dirname(foundPath);

        let $variables;
        if(config.$variables)
        {
            if(typeof config.$variables == "string")
            {
                // $ref()
                let res = this.mapVariables({variables:config.$variables},variables,curPath2);
                $variables = res.variables;    
            }
            else
            {
                // inline list
                $variables = config.$variables;
            }

            // apply parent variables
            if(variables)
                $variables = this.mapVariables($variables,variables,curPath2);
        }

        if(variables || $variables)
        {
            variables = variables || {};
            $variables = $variables || {}
            variables = {...variables,...$variables};

            config = this.mapVariables(config,variables,curPath2);  

            if(config.$dump_config)
            {
                const dumpPath = foundPath+'_parsed.yml';
                debug.log("dump parsed config to "+dumpPath)
                this.saveConfig(dumpPath,config,true);
            }
        }

        return config;
    }

    saveConfig(path,config,sync=false) 
    {
        if(sync)
            fs.writeFileSync(path,yaml.safeDump(config));
        else
            fs.writeFile(path,yaml.safeDump(config),(err) => 
            {
                if (err) {
                    console.log(err);
                }
            });
    }

	// I/O
    existsConfig(path) 
    {
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

module.exports = new ConfigSce();

module.exports.ConfigSce = ConfigSce;