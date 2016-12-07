[![Build Status](https://travis-ci.org/Agile-IoT/agile-idm-core.svg?branch=master)](https://travis-ci.org/Agile-IoT/agile-idm-core)

# AGILE IDM Core

AGILE IDM Core takes care of validating the schema of entities, and to apply policies whenever attributes for policies are change or read. For storage, the AGILE IDM Entity Storage component is used (see https://github.com/Agile-IoT/agile-idm-entity-storage).

## Main Responsibilities

In short, the main responsibilities of this component include:
* entity schema validation:  Agile IDM Core ensures not only that required attributes are there and they have the proper type, but also that only attributes which are expected are stored in the database.
* apply writing policies to attributes: Agile IDM Core ensures that a set of predefined policies are met when updating an entity attribute.
* applying policies when users attempt to read attributes:  Agile IDM Core  ensures that the user querying attributes for a given entity, he/she only obtains the attributes that he/she is allowed to read.
* attribute management and managing ownership: on top of storing the attributes passed to the Agile IDM Core component, it also includes the owner as an attribute.
* handling groups this component also allows to place and remove entities from groups.

To fully understand how attribute policies help to manage identities, please check the attribute model documentation available in (https://github.com/Agile-IoT/agile-idm-web-ui/blob/master/docs/identity-model.md).

## API interface

This component can be imported as a node.js module, and offers a promise-based API allowing the following operations:
* create, read and delete entities
* update entity attributes (equivalent to update entity, but with more granular access control, i.e. per attribute enforcement)
* create and delete groups
* add and remove entities to a group (equivalent to group update).
* look up entities for a given set of attribute values. For instance, it is possible to find entities with a particular owner and attribute name equal to "my sensor".

Although this component is only used by AGILE-IDM Web, in case the reader is interested in usage examples, this component is currently used to expose an http-based version of all the calls in the AGILE-IDM-WEB api (see https://github.com/Agile-IoT/agile-idm-web-ui/tree/master/routes/api). Also, given that every functionality is tested with unit test which verify response or expected status codes in the test folder of the AGILE IDM Core github repository, tests could also be used as a starting point to interact with the AGILE IDM Core node js module.

# Debug mode

For debugging purposes, information will be logged to standard output if  the  variable DEBUG_IDM_CORE is defined to be 1, in the following way:

export DEBUG_IDM_CORE=1

If no variable is set, or if any other value different than 1 is set, this component runs in quiet mode.
