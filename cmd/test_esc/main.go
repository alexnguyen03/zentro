package main

import (
	"fmt"
	"net/url"
)

func main() {
	user := "user name"
	pass := "p@ss:word"
	fmt.Println("QueryEscape:", url.QueryEscape(pass))
	fmt.Println("PathEscape:", url.PathEscape(pass))
	fmt.Println("UserPassword:", url.UserPassword(user, pass).String())
}
