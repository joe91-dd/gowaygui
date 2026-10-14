cmake_minimum_required(VERSION 3.8)

option(APP_NAME "Project Name" "gowaygui")
project(${APP_NAME} CXX)
# Bound peak compiler memory on the 8 GB packaging machine. Ninja otherwise
# launches one large Cocos translation unit per CPU thread.
set_property(GLOBAL PROPERTY JOB_POOLS gowaygui_compile=4 gowaygui_link=1)
set(CMAKE_JOB_POOL_COMPILE gowaygui_compile)
set(CMAKE_JOB_POOL_LINK gowaygui_link)
set(CC_LIB_NAME cocos)
set(CC_PROJECT_DIR ${CMAKE_CURRENT_LIST_DIR})
set(CC_PROJ_SOURCES)
set(CC_COMMON_SOURCES)
set(CC_ALL_SOURCES)

include(${CMAKE_CURRENT_LIST_DIR}/../common/CMakeLists.txt)

cc_android_before_target(${CC_LIB_NAME})
add_library(${CC_LIB_NAME} SHARED ${CC_ALL_SOURCES})
cc_android_after_target(${CC_LIB_NAME})
# Support recent ARM64 Android devices using 16 KB memory pages.
target_link_options(${CC_LIB_NAME} PRIVATE "-Wl,-z,max-page-size=16384")
