[![Build Status](https://travis-ci.org/Agile-IoT/agile-idm-core.svg?branch=master)](https://travis-ci.org/Agile-IoT/agile-idm-core)

#AGILE IDM Core

This project takes care of the registration of entities in the AGILE IDM.
The main responsibilities include:
* alidation of an entity schema (i.e. required proerties are there, and they are of the proper type)
* applying security policies to ensure that only attribute authorities can set an attribute.
* applying policies when users attempt to read data, and redact the data in case they can only see certain attributes, but others not.


# Debug mode

If you define the following variable (to be 1) this module will print debugging information.

export DEBUG_IDM_CORE=1

If no variable is set, or if any other value different than 1 is set, this component runs in quiet mode.
