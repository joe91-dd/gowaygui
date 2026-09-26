"""Rebuild bubble c02 atlas entirely from its authored numeric/UV/noise source.
No finished PNG is an input. Callable from build and independent QA.
"""
import ast
from pathlib import Path
import bpy
import numpy as np

def rebuild(parameter_source,helper_source,destination):
    parameter_source=Path(parameter_source);helper_source=Path(helper_source)
    tree=ast.parse(parameter_source.read_text(encoding='utf-8'))
    parameters=[n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('PALETTE','ATLAS_PARAMETERS') for t in n.targets)]
    transforms=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='LocalAtlasParameters']
    assert len(parameters)==2 and len(transforms)==1
    namespace={'ast':ast,'bpy':bpy,'np':np,'Path':Path}
    exec(compile(ast.Module(body=parameters+transforms,type_ignores=[]),str(parameter_source),'exec'),namespace)
    helper_tree=ast.parse(helper_source.read_text(encoding='utf-8'))
    functions=[n for n in helper_tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_atlas']
    assert len(functions)==1
    module=namespace['LocalAtlasParameters']().visit(ast.Module(body=functions,type_ignores=[]));ast.fix_missing_locations(module)
    exec(compile(module,str(helper_source),'exec'),namespace)
    images=namespace['build_atlas'](Path(destination))
    return images,namespace['ATLAS_PARAMETERS']

