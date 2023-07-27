-
  ``` clojure
	  (def s "my string")
	  
	  (defn my-fn [s]
	    (str "here is " s))
	  
	  (my-fn s)
  ```
	- `(map inc [1 2 3])` already works, because I added inc!
- # Demo
	- I made a vite demo app, it works locally but fails in prod...
	- the preview works but errors, but the deployed version won't load at all. like... even the favicon 404s. It's like... reading the wrong index.html...
	- fartballs. It's the end of the day and it would have been really fucking amazing to get it launched. I'm confused and eepy so maybe I'll figure it out in the morning
	- omg, I actually figured out the bigger problem of it not deploying at all. I was using the stock static deployment workflow which was different from the one in the vite docs.
	- So now I just have the weirder issue of it not working in prod. The local vite preview has the same issue.
	- I found the difference! In dev mode, typeof module is undefined. But when built, it's an object!
	- when I print out the `env`, it is an empty map in prod.
	- I don't know how to debug the env because it uses constructors which make no sense. I'm going to try to do it with regular objects or something.
	- Seems to be coming along well. But right now, the env is coming up undefined.
	- Ah, the problem seems to be that the env needs to be passed to the eval-region functions. But does it? I don't think so. The job of that is just to send the correct form to be evaluated.
	- It actually works! wow, I might not be as dumb as I thought.
- # Core library
	- What's broken now? I know that macros don't work yet, but I bet I can find something even before that. For example, hash maps are still broken. Let's go through the [demo app](http://kanaka.github.io/mal/) and see what works and what doesn't:
	- maps                      no
	- let                         no
	- list                          yes
	- vectors                   yes
	- scalars                   yes
	- anonymous fns     no?    `((fn [n] (+ n 2)) 1) => "12"`
		- which is weird, because addition works by itself
	- if                             yes
	- cond                       no, macro
	- comparisons/bools yes
	- predicates               yes
	- map, apply              yes
	- list, vector, hash-map  yes
	- conj, cons               yes
	- first, rest, nth         yes
	- last                           no
	- atoms                     yes
	- js interop                yes
	- Damn. this is pretty good! The first thing I should try to fix is hashmaps.
	- The `hash-map` function works:
		-
		  ``` clojure
		  			  (hash-map :a 1 :b 2)
		  			   => {:a 1 :b 2}
		  ```
	- You can even save it using def and call it. What does not work is evaluating a hashmap itself, i.e. `{:a 1 :b 2}`. We get `ReferenceError: k is not defined`.
	- The AST: `{ʞa: 1, ʞb: 2}` what in the world is that? that character is not in the code anywhere, only the bundled output.
	- Even `get` works on maps, as long as it was created with `hash-map`. But the literal syntax fails.
	- The eval-cell command doesn't seem to work right, it gives the value of the first form, not the second.
	- It recognizes the literal hash-map correctly.
	- Fixed it! Wow! it's because this was missing the word `const`:
	-
	  ``` js
	  		  for (const k in ast) {
	  		        console.log("k:", k)
	  		        new_hm[k] = EVAL(ast[k], env);
	  		      }
	  ```
	- well there we have it. I'm not an idiot.
	- the `let` thing seems to be the biggest issue now.
	- the let_env might not be right. It correctly creates a new scope with the let variables defined in it. But the outer env contains 3 keys instead of 2, one of them being current_env which shouldn't be there. The data is correct though.
	- Omg, it works!
- # Macros... or not
	- I got macros working... I think. But cond doesn't work as expected.
	- This works in the mal demo:
	-
	  ``` clojure
	  		  (cond
	  		    (< 1 0) "negative"
	  		    (> 1 0) "positive"
	  		    :else "zero")
	  		  ;;=> "positive"
	  ```
	- but in mine, it returns `odd number of forms to cond`. So that would seem that the macros work in general, but there's a bug somewhere else...
	- this is the cond macro:
	-
	  ``` clojure
	  		  (defmacro cond 
	  		                (fn (& xs) 
	  		                  (if (> (count xs) 0) 
	  		                      (list 'if (first xs) 
	  		                                (if (> (count xs) 1) 
	  		                                    (nth xs 1) 
	  		                                    (throw \"odd number of forms to cond\")) 
	  		                                (cons 'cond (rest (rest xs)))))))
	  ```
	- could we do defn?
	- yeah, I added `or` which is a macro that requires gensym. so I added that too. but the output of `or` is fucky. So the macros are correct, just something else is messed up.
	- hmm... I still hadn't enabled macroexpansion so that may be why. but when I do it says that `mac.apply is not a function`.
	- I enabled the macroexpansion step in the `apply list` part of the interpreter, but commented out the function body of macroexpand. It actually doesn't make it past the *check* if it's a macro call, because of a problem in the `findKeyInEnv` function. It's recursive, and was stack overflowing because it wasn't finding the symbol. There's something inherently wrong with the env stuff, so I'd better start by confirming what I can.
- ## Mal workshop - environment
	- this is part 2 of the workshop, and he gets into the environment and everything. https://www.youtube.com/watch?v=X5OQBMGpaTU
	- He talks about how the environment is a nested object with a pointer to its parent, or `outer`, and you look up the symbol at each level until you get to the top. timestamp: 30:20
- ## Debugging functions
	- I fixed `evalCell` by wrapping the result in a `do`.
	- `do` evaluates `ast.slice(1, -1)`. So it skips the first one, the actual `do`.
	- `let` is working perfectly. I thought it was doing it wrong but I think not!
	- ok so this is weird:
	-
	  ``` clojure
	  		  ((fn [x] x) 5)
	  		   => (5)
	  ```
	- this might help explain this:
	-
	  ``` clojure
	  		  ((fn [n] (+ n 2)) 1)
	  		   => "12"
	  ```
	- The definition for `fn`:
	-
	  ``` js
	  		  case "fn":
	  		    return types._function(EVAL, a2, env, a1);
	  ```
	- Trying to figure out what `_clone` does. It's used in 4 places:
	- 1. `defmacro`
		2. `assoc`
		3. `dissoc`
		4. `with_meta`

	- assoc/dissoc work.
	- As we can see, the anonymous function always puts the result in a list:
	-
	  ``` clojure
	  		  ((fn [x]	 x) '(1 2 3))
	  		   => ((1 2 3))
	  ```
		- what is `__gen_env__`?
		- uhm...
		-
		  ``` clojure
		  			  (+ 1 2 3) => 3 
		  ```
		- oh, that makes sense. `+` only takes 2 args, duh. I could fix it by like applying sum or something.
		- The eval function is recursive, it's in a while loop. If it makes it to the end without returning, it runs again. This happens in the case of lambdas defined with `fn`. It sets its scope
		- At the time that the symbol x is looked up in the final step of the evaluation, it's *already in an array*. Which means we have to go back to when it was defined.
		- How does this work, really?
		-
		  ``` clojure
		  			  export function _function(Eval, ast, env, params) {
		  			      const fn = function() {
		  			          return Eval(ast, bindExprs(env, params, arguments))
		  			      }
		  			      fn.__meta__ = null;
		  			      fn.__ast__ = ast;
		  			      fn.__gen_env__ = function(args) {
		  			          return bindExprs(env, params, arguments)
		  			      }
		  			      fn._ismacro_ = false;
		  			      return fn;
		  			  }
		  ```
		- It's passed
		- 1. the eval function itself
			2. `a2`, the 3rd element of the ast being evaluated. I'm guessing that is the function body? `fn`, vector, arg, body? Seems plausible... `a2` is the ast,
			3. and `a1` is passed as `params`. Yes! that makes sense!

		- It binds the names in the environment with `bindExprs(env, params, arguments)`
		- omg, I figured it out. I accidently was passing `arguments` instead of `args` above. You can see the mistake if you stare at it long enough which I just did, while comparing to the original. Somehow I messed it up while fucking with it.
		- Now this works:
		-
		  ``` clojure
		  			  ((fn [n] (+ n 2)) 1)
		  			   => 3
		  ```
- # Fuck macros
	- So now it's just macros I'm missing!
	- Here is how `cond` should work:
	-
	  ``` clojure
	  		  (cond  
	  		    (< 1 0) "negative" 
	  		    (> 1 0) "positive" 
	  		    :else "zero")
	  		  ;;=> "positive"
	  ```
	- I'm having trouble with it. It's not making sense. I could skip it for now... and I can just implement more functions as special forms.
- # Defn
	- That's fine with me actually. I don't need macros to finish the interpreter by making it more Clojure compatible. I'll try to make `defn`.
	- omg ![image.png](../assets/image_1689591065047_0.png)
	- This is the special form:
	-
	  ``` js
	  		  case "defn":
	  		     const fn = types._function(EVAL, a3, env, a2);
	  		     return _env.addToEnv(env, a1, fn)
	  ```
	- Cool, I guess that's enough for today, it's 4am, everything is checked in, demo is live, and macros are *off limits*...
	- ok it's noon the next day, just got up. I don't know *why* the function above works, because I just tried another which doesn't:
	-
	  ``` clojure
	  		  (defn mr [n]
	  		    (map inc (range n)))
	  		  
	  		  (mr 5) => 
	  		  Error: f.apply is not a function 
	  ```
	- And yes, this still works (I refreshed the page)
	-
	  ``` clojure
	  		  (defn yo [n]
	  		    (str "yo " n))
	  		  	
	  		  (yo "dawg")
	  		   => "yo dawg"
	  ```
	- So what's the difference between these 2?
	- OMG. It's because we don't have `range` yet!!!!!!!!!!!!!!!!!!!!
- # Range
	- now we do! it's pretty dumb:
	-
	  ``` js
	  		  function range(start, end) {
	  		      if (!end) {
	  		          return range(0, start)
	  		      }
	  		      var ans = [];
	  		      for (let i = start; i <= end; i++) {
	  		          ans.push(i);
	  		      }
	  		      return ans;
	  		  }
	  ```
- # Testing with Exercism
	- Made a dummy function so that using `ns` won't break it. Now we can actually use it for exercism exercises, like hello world, and the lasagna exercise:
	-
	  ``` clojure
	  		  (ns lucians-luscious-lasagna)
	  		  
	  		  (def expected-time 40)
	  		  
	  		  (defn remaining-time [actual-time]
	  		    (- expected-time actual-time))
	  		  
	  		  (defn prep-time [num-layers]
	  		    (* num-layers 2))
	  		  
	  		  (defn total-time [num-layers actual-time]
	  		    (+ (prep-time num-layers) actual-time))
	  		  
	  		  (total-time 4 8)
	  		   => 16
	  ```
- # Threading macros
	- The next would be the list exercise, which as we know is best solved using a threading macro. Seems like that might be hard. Let's try!
	- First of all, the exercise works using normal calls:
	-
	  ``` clojure
	  		  (ns tracks-on-tracks-on-tracks)
	  		  
	  		  (defn new-list [] '())
	  		  
	  		  (defn add-language [lang-list lang] 
	  		    (conj lang-list lang))
	  		  
	  		  (defn first-language [lang-list] 
	  		    (first lang-list))
	  		  
	  		  (defn remove-language [lang-list] 
	  		    (rest lang-list))
	  		  
	  		  (defn count-languages [lang-list]
	  		    (count lang-list))
	  		  
	  		  (defn learning-list [] 
	  		    (count-languages 
	  		      (add-language 
	  		        (add-language 
	  		          (remove-language 
	  		            (add-language 
	  		              (add-language (new-list) "Clojure") 
	  		              "Lisp")) 
	  		          "Java") 
	  		        "Javascript")))
	  		  
	  		  (learning-list)
	  		   => 3
	  ```
	- Here is the definition of Clojure's thread-first macro:
	-
	  ``` clojure
	  		  (defmacro ->  [x & forms]
	  		    (loop [x x, forms forms]
	  		      (if forms
	  		        (let [form (first forms)
	  		              threaded (if (seq? form)
	  		                         (with-meta `(~(first form) ~x ~@(next form)) (meta form))
	  		                         (list form x))]
	  		          (recur threaded (next forms)))
	  		        x)))
	  ```
	- I wonder if I should try making loop/recur first? that actually seems harder. Wait, don't we supposedly have TCO already? If so, could we just replace `recur` with the regular function? I also don't understand why we need to use metadata.
	- I have a version that works with a single list:
	-
	  ``` clojure
	  		  (-> "hello"
	  		      (str " kitty"))
	  		   => "hello kitty"
	  ```
	- code:
	-
	  ``` js
	  		  case "->":
	  		     const form = a1
	  		     const last = ast.slice(2)[0].slice(1)[0]
	  		     return EVAL(ast.slice(2)[0].slice(0, 1).concat(form).concat(last), env)
	  ```
	- What we need to do is build an array out of the items in the ast, make them lists, and interleave them
	- This code outputs our lists by putting the forms that are not lists into lists
	-
	  ``` js
	  		  case "->":
	  		          const form = a1
	  		          const rest = ast.slice(2)
	  		          let lists = []
	  		          for (let i = 0; i < rest.length; i++) {
	  		            if (types._list_Q(rest[i])) {
	  		              lists.push(rest[i])
	  		            } else {
	  		              lists.push([rest[i]])
	  		            }
	  		          }
	  		          return lists
	  ```
	- output:
	-
	  ``` clojure
	  		  (learning-list)
	  		   => ((add-language "Clojure") (add-language "Lisp") (remove-language) (add-language "Java") (add-language "JavaScript") (count-languages))
	  ```
	- alright I think I got it! I put a shit load of comments in the code.
	-
	  ``` js
	  		  // Let's make a function that will just thread one form into the other 
	  		  // It threads the *form* *into* the *expr*.
	  		  // `expr` must be a list.
	  		  // Example:
	  		  // `expr` -> (add-language "Clojure")
	  		  // `form` -> (new-list)
	  		  // output: (add-language (new-list) "Clojure")
	  		  // But it needs to handle cases where the expr is a list of 1.
	  		  function threadFirst(form, expr) {
	  		    let l = expr.slice(0, 1)
	  		    let r = expr.slice(1)[0]
	  		    l.push(form)
	  		    if (r) {
	  		      l.push(r)
	  		    }
	  		    return l
	  		  }
	  		  
	  		  function _EVAL(ast, env) {
	  		    ...
	  		    case "->":
	  		          // First element in the AST, a0, is the actual thread-first operator (`->`)
	  		          // so a1 is the first form to be threaded into the following exprs
	  		          const first = a1
	  		          // Make a new list of just the forms to be *threaded*,
	  		          // i.e. the ones that have forms threaded *into* them.
	  		          // so we slice it at 2
	  		          const rest = ast.slice(2)
	  		          let lists = []
	  		          // make each form to be threaded into a list
	  		          // if it is not a list already
	  		          for (let i = 0; i < rest.length; i++) {
	  		            if (types._list_Q(rest[i])) {
	  		              lists.push(rest[i])
	  		            } else {
	  		              lists.push([rest[i]])
	  		            }
	  		          }
	  		          console.log("lists:", lists)
	  		          let threaded = first
	  		          console.log(first)
	  		          for (let i = 0; i < lists.length; i++) {
	  		            threaded = threadFirst(threaded, lists[i])
	  		            console.log(threaded)
	  		          }
	  		         return EVAL(threaded, env)
	  		  }
	  ```
	- And thread-last is done!
	-
	  ``` clojure
	  		  (->> "kitty"
	  		    (str "hello ")
	  		    (str "say hi to "))
	  		   => "say hi to hello kitty"
	  ```
- Fogus started a new creation-forum in the server, so I posted this in it
- Implemented `pop`. Works like `conj`, i.e. different behavior on lists/vectors.
- Going through the bird watcher exercise. At the point where we need the anonymous function syntax.
- Also, we need `assoc` to work with vectors... done. Also did `dissoc`.
- # anonymous shorthand syntax
	- I need to implement `#` in the reader as in `@`
	- omg I did it already! That was actually... fn lol
- So, I did that because I'm up to this part of bird watcher:
-
  ``` clojure
	  (defn day-without-birds? [birds]
	    (boolean (some #(= 0 %) birds)))
  ```
- that was just for the function passed to `some`. So now I need to do that
- Here's the source:
-
  ``` clojure
	  (defn some
	    "Returns the first logical true value of (pred x) for any x in coll,
	    else nil.  One common idiom is to use a set as pred, for example
	    this will return :fred if :fred is in the sequence, otherwise nil:
	    (some #{:fred} coll)"
	    {:added "1.0"
	     :static true}
	    [pred coll]
	      (when-let [s (seq coll)]
	        (or (pred (first s)) (recur pred (next s)))))
  ```
- should I try to do recur? Without loop, all I should have to do is replace it with the function being called. Assuming that TCO really works...
- Here is a basic example from clojuredocs
-
  ``` clojure
	  (defn compute-across [func elements value]
	    (if (empty? elements)
	      value
	      (recur func (rest elements) (func value (first elements)))))
  ```
- I'm going to have to check if a function call has a recur in it beforehand, so that it can be swapped ahead of time. Which means I'm going to have to walk the ast to do a search/replace, I can't do it with strings because we need the data structure intact.
- # AST walking
	- I haven't fully grasped how clojure.walk works, so I guess I'm going to need to now! I don't understand how it advances through the subforms.
	- Here are the functions with the docstrings removed for brevity:
	-
	  ``` clojure
	  		  (defn walk [inner outer form]
	  		    (cond
	  		      (list? form) (outer (apply list (map inner form)))
	  		      (instance? clojure.lang.IMapEntry form)
	  		      (outer (clojure.lang.MapEntry/create (inner (key form)) (inner (val form))))
	  		      (seq? form) (outer (doall (map inner form)))
	  		      (instance? clojure.lang.IRecord form)
	  		      (outer (reduce (fn [r x] (conj r (inner x))) form form))
	  		      (coll? form) (outer (into (empty form) (map inner form)))
	  		      :else (outer form)))
	  		  
	  		  (defn postwalk [f form]
	  		    (walk #(postwalk f %) f form))
	  		  
	  		  (defn prewalk [f form]
	  		    (walk (partial prewalk f) identity (f form)))
	  		  
	  		  (defn postwalk-demo [form]
	  		    (postwalk (fn [x] (print "Walked: ") (prn x) x) form))
	  		  
	  		  (defn prewalk-demo [form]
	  		    (prewalk (fn [x] (print "Walked: ") (prn x) x) form))
	  		  
	  		  (postwalk-demo [1 2 [3 4]])
	  ```
	- I'm beginning to understand... it uses map to call the "inner" function on each element.
	- Here's what I have so far:
	-
	  ``` js
	  		  function walk(inner, outer, form) {
	  		    if (types._list_Q(form)) {
	  		      return outer(form.map(inner))
	  		    }
	  		    if (types._vector_Q(form)) {
	  		      let v = outer(form.map(inner))
	  		      v.__isvector__ = true;
	  		      return v
	  		    }
	  		    if (types._hash_map_Q(form)) {
	  		      
	  		    }
	  		  }
	  ```
	- So what do we do for hashmaps? In Clojure it's handled by the `coll?` bbranch:
	-
	  ``` clojure
	  		  (into (empty form) (map inner form))
	  ```
	- This relies on the fact that we can map on a map, lol
	- We have `seq`, but it doesn't work on maps. I'll have to add that.
	- Here's my final implementation:
	-
	  ``` js
	  		  function walk(inner, outer, form) {
	  		    if (types._list_Q(form)) {
	  		      return outer(form.map(inner))
	  		    } else if (types._vector_Q(form)) {
	  		      let v = outer(form.map(inner))
	  		      v.__isvector__ = true;
	  		      return v
	  		    } else if (form.__mapEntry__) {
	  		      const k = inner(form[0])
	  		      const v = inner(form[1])
	  		      let mapEntry = [k, v]
	  		      mapEntry.__mapEntry__ = true
	  		      return outer(mapEntry)
	  		    } else if (types._hash_map_Q(form)) {
	  		      const entries = seq(form).map(inner)
	  		      let newMap = {}
	  		      entries.forEach(mapEntry => {
	  		        newMap[mapEntry[0]] = mapEntry[1]
	  		      });
	  		      return outer(newMap)
	  		    } else {
	  		      return outer(form)
	  		    }
	  		  }
	  		  
	  		  function postwalk(f, form) {
	  		    return walk(x => postwalk(f, x), f, form)
	  		  }
	  ```
	- Implemented `recur` in `defn` forms:
	-
	  ``` js
	  		  let swapRecur = types.postwalk(x => {
	  		        if (x.value == types._symbol("recur")) {
	  		           return types._symbol(ast[1].value)
	  		        } else {
	  		            return x
	  		        }
	  		        return x
	  		    }, ast)
	  		  
	  		  ...
	  		  
	  		  case "defn":
	  		          const fn = types._function(EVAL, swapRecur[3], env, swapRecur[2]);
	  		          _env.addToEnv(env, swapRecur[1], fn)
	  		          return "#'" + namespace + "/" + swapRecur[1]
	  ```
	- Now it won't be hard to implement `loop`. What other recur targets are there? According to the [Clojure reference](https://clojure.org/reference/special_forms#recur), it can be any `fn`.
	- But wait... we can't do that, because the function doesn't have a name... uh, could we just replace it with the function? Yes, actually that makes more sense!!!!
	- Actually, I thought of doing it that way, by modifying the `_function` function, but then I realized we couldn't get the name... but that doesn't matter! my first idea was correct. we will just swap recur for the function itself, since it is a first class object.
	- I fucking did it. After sleepies (it's 6:22am!) I can try to implement `loop`.
	- Ok. So I think I'm going to have to move the `recur` logic back into the interpreter, rather than the main function definition because otherwise there's no way to do `loop` that I can think of.
	- So... the main issue that I see is that if we have `recur` as its own special form is, we need a way to refer back to the last "target", whether it be a `fn` definition or a `loop` form. So we'll introduce a special variable that will be reset whenever those points are hit.
	- Having trouble getting it to work. Watching my edited video of the mal workshop, and recording it again through OBS to get a cleaned up version of the audio via the RNNoise plugin.
	- Audio is done. exporting as mp3
	- I edited the video too, to crop it to just the viewscreen :) Rendering it now, it says it will be done in 1:30:00 (90 min)
- # Environment bug?
	- Something seems off. Remember when it was creating a seemingly infinite series of environments? Well, uh, I guess I never solved that problem.
	- I think `bindExprs` is incorrect. Indeed, it sets the outer env every time.
	- yeah, bindExprs is just supposed to return a new env with the data set. So that means it doesn't need the env passed at all.
	- Or is it supposed to have the outer set to the env passed in? I'm confused. Goodnews: my video is done rendering! It's great, now I can actually see what he's doing
- # Testing
	- This will be a big help. I can use vitest. I'll start with the reader tests.
	- Yes! There is a bug in the env and this is what causes it:
	-
	  ``` js
	  		  let env1 = init_env
	  		  setInEnv(env1, 'a','val_a')
	  		  setInEnv(env1, 'b','val_b')
	  		  console.log(getKeyInEnv(env1, 'a'))
	  ```
	- It obviously should output 'val_a', but it outputs 'val_b'!
	- Ok, tests are all passing.
	- ## Exercism
		- I've been implicitly building up features by going through exercism. So what if I hooked up something like the exercism CI script?
		- First of all, we're going to need `load-file` or something.
		- I should build out a test runner right in the demo app. I'm watching Jeremy's presentation on the test runner tooling, and it's frightening me and inspiring me to come up with a better way.
		- `ns` will have another purpose - and I won't have to change anything. The current namespace will decide which exercise is being run. I'll copy over the test suites.
		- You know what? I'm going to make this a new project.
		- It will be able to load stubs as well.
		- Wait... does `slurp` work? OMG IT DOES
		- I'll include the test files anyway, so it will work offline
		- omg... I just spent hours getting a drop-down menu that loads the exercises, but it's done. What I wanted to do was fetch them from the actual source files, but apparently you can't do that so I had to make a json file with all the exercise stubs in it. So I guess now I'm going to have to do something similar for the test suites.
		- Cool, I've got a decent looking app:
		- ![image.png](../assets/image_1689990234748_0.png)
- # Threading *actual* macros
	- Guess what I just found...
	-
	  ``` clojure
	  		  ;; Rewrite x (a a1 a2) .. (b b1 b2) as
	  		  ;;   (b (.. (a x a1 a2) ..) b1 b2)
	  		  ;; If anything else than a list is found were `(a a1 a2)` is expected,
	  		  ;; replace it with a list with one element, so that `-> x a` is
	  		  ;; equivalent to `-> x (list a)`.
	  		  (defmacro! ->
	  		    (fn* (x & xs)
	  		      (reduce _iter-> x xs)))
	  		  
	  		  (def! _iter->
	  		    (fn* [acc form]
	  		      (if (list? form)
	  		        `(~(first form) ~acc ~@(rest form))
	  		        (list form acc))))
	  		  
	  		  ;; Like `->`, but the arguments describe functions that are partially
	  		  ;; applied with *left* arguments.  The previous result is inserted at
	  		  ;; the *end* of the new argument list.
	  		  ;; Rewrite x ((a a1 a2) .. (b b1 b2)) as
	  		  ;;   (b b1 b2 (.. (a a1 a2 x) ..)).
	  		  (defmacro! ->>
	  		    (fn* (x & xs)
	  		       (reduce _iter->> x xs)))
	  		  
	  		  (def! _iter->>
	  		    (fn* [acc form]
	  		      (if (list? form)
	  		        `(~(first form) ~@(rest form) ~acc)
	  		        (list form acc))))
	  ```
	- Oh, wait, there's reduce? Where?
	- Holy shit, there's a whole standard library I hadn't seen yet.
	- https://github.com/kanaka/mal/blob/master/impls/lib/reducers.mal
	-
	  ``` clojure
	  		  (def! reduce
	  		    (fn* (f init xs)
	  		      ;; f      : Accumulator Element -> Accumulator
	  		      ;; init   : Accumulator
	  		      ;; xs     : sequence of Elements x1 x2 .. xn
	  		      ;; return : Accumulator
	  		      (if (empty? xs)
	  		        init
	  		        (reduce f (f init (first xs)) (rest xs)))))
	  ```
	- nice, it's just a regular function. But I've got to get macros working
	- JavaScript is so annoying, I hate it. I can't even figure out how to get keys in an object
- Mal workshop transcript
	- https://www.youtube.com/watch?v=9Jn1VlVZRww
- Macros are working! The bug is this... the `Symbol` types were changed to `Symbol$1`, which is why it was tripping the checks. So I removed them! Problem solved!
- # Loop
	- `loop` is a macro:
	-
	  ``` clojure
	  		  (defmacro loop
	  		    "Evaluates the exprs in a lexical context in which the symbols in
	  		    the binding-forms are bound to their respective init-exprs or parts
	  		    therein. Acts as a recur target."
	  		    {:added "1.0", :special-form true, :forms '[(loop [bindings*] exprs*)]}
	  		    [bindings & body]
	  		      (assert-args
	  		        (vector? bindings) "a vector for its binding"
	  		        (even? (count bindings)) "an even number of forms in binding vector")
	  		      (let [db (destructure bindings)]
	  		        (if (= db bindings)
	  		          `(loop* ~bindings ~@body)
	  		          (let [vs (take-nth 2 (drop 1 bindings))
	  		                bs (take-nth 2 bindings)
	  		                gs (map (fn [b] (if (symbol? b) b (gensym))) bs)
	  		                bfs (reduce1 (fn [ret [b v g]]
	  		                              (if (symbol? b)
	  		                                (conj ret g v)
	  		                                (conj ret g v b g)))
	  		                            [] (map vector bs vs gs))]
	  		            `(let ~bfs
	  		               (loop* ~(vec (interleave gs gs))
	  		                 (let ~(vec (interleave bs gs))
	  		                   ~@body)))))))
	  ```
	- That's the one with destructuring, which is uh, kinda hairy:
		-
		  ``` clojure
		  			  (defn destructure [bindings]
		  			    (let [bents (partition 2 bindings)
		  			          pb (fn pb [bvec b v]
		  			               (let [pvec
		  			                     (fn [bvec b val]
		  			                       (let [gvec (gensym "vec__")
		  			                             gseq (gensym "seq__")
		  			                             gfirst (gensym "first__")
		  			                             has-rest (some #{'&} b)]
		  			                         (loop [ret (let [ret (conj bvec gvec val)]
		  			                                      (if has-rest
		  			                                        (conj ret gseq (list `seq gvec))
		  			                                        ret))
		  			                                n 0
		  			                                bs b
		  			                                seen-rest? false]
		  			                           (if (seq bs)
		  			                             (let [firstb (first bs)]
		  			                               (cond
		  			                                (= firstb '&) (recur (pb ret (second bs) gseq)
		  			                                                     n
		  			                                                     (nnext bs)
		  			                                                     true)
		  			                                (= firstb :as) (pb ret (second bs) gvec)
		  			                                :else (if seen-rest?
		  			                                        (throw (new Exception "Unsupported binding form, only :as can follow & parameter"))
		  			                                        (recur (pb (if has-rest
		  			                                                     (conj ret
		  			                                                           gfirst `(first ~gseq)
		  			                                                           gseq `(next ~gseq))
		  			                                                     ret)
		  			                                                   firstb
		  			                                                   (if has-rest
		  			                                                     gfirst
		  			                                                     (list `nth gvec n nil)))
		  			                                               (inc n)
		  			                                               (next bs)
		  			                                               seen-rest?))))
		  			                             ret))))
		  			                     pmap
		  			                     (fn [bvec b v]
		  			                       (let [gmap (gensym "map__")
		  			                             gmapseq (with-meta gmap {:tag 'clojure.lang.ISeq})
		  			                             defaults (:or b)]
		  			                         (loop [ret (-> bvec (conj gmap) (conj v)
		  			                                        (conj gmap) (conj `(if (seq? ~gmap) (clojure.lang.PersistentHashMap/create (seq ~gmapseq)) ~gmap))
		  			                                        ((fn [ret]
		  			                                           (if (:as b)
		  			                                             (conj ret (:as b) gmap)
		  			                                             ret))))
		  			                                bes (let [transforms
		  			                                            (reduce1
		  			                                              (fn [transforms mk]
		  			                                                (if (keyword? mk)
		  			                                                  (let [mkns (namespace mk)
		  			                                                        mkn (name mk)]
		  			                                                    (cond (= mkn "keys") (assoc transforms mk #(keyword (or mkns (namespace %)) (name %)))
		  			                                                          (= mkn "syms") (assoc transforms mk #(list `quote (symbol (or mkns (namespace %)) (name %))))
		  			                                                          (= mkn "strs") (assoc transforms mk str)
		  			                                                          :else transforms))
		  			                                                  transforms))
		  			                                              {}
		  			                                              (keys b))]
		  			                                      (reduce1
		  			                                          (fn [bes entry]
		  			                                            (reduce1 #(assoc %1 %2 ((val entry) %2))
		  			                                                     (dissoc bes (key entry))
		  			                                                     ((key entry) bes)))
		  			                                          (dissoc b :as :or)
		  			                                          transforms))]
		  			                           (if (seq bes)
		  			                             (let [bb (key (first bes))
		  			                                   bk (val (first bes))
		  			                                   local (if (instance? clojure.lang.Named bb) (with-meta (symbol nil (name bb)) (meta bb)) bb)
		  			                                   bv (if (contains? defaults local)
		  			                                        (list `get gmap bk (defaults local))
		  			                                        (list `get gmap bk))]
		  			                               (recur (if (ident? bb)
		  			                                        (-> ret (conj local bv))
		  			                                        (pb ret bb bv))
		  			                                      (next bes)))
		  			                             ret))))]
		  			                 (cond
		  			                  (symbol? b) (-> bvec (conj b) (conj v))
		  			                  (vector? b) (pvec bvec b v)
		  			                  (map? b) (pmap bvec b v)
		  			                  :else (throw (new Exception (str "Unsupported binding form: " b))))))
		  			          process-entry (fn [bvec b] (pb bvec (first b) (second b)))]
		  			      (if (every? symbol? (map first bents))
		  			        bindings
		  			        (reduce1 process-entry [] bents))))
		  ```
	- We won't be doing that any time soon. But here is the non-destructuring loop:
	-
	  ``` clojure
	  		  (def
	  		   ^{:macro true
	  		     :added "1.0"}
	  		   loop (fn* loop [&form &env & decl] (cons 'loop* decl)))
	  ```
	- Could it be that simple?
- It's almost like a step-debugger: 
	- ![image.png](../assets/image_1689922075876_0.png)
- I found those delicious threading macros in the mal repo, in the root of the `impls` directory. What else is in there?
- So holy shit. Seems like it's finally come together.
- I'm back at that hashmap problem again. what did I end up doing for that? That's right... there was a missing const or something
- A couple of tests are failing in types.test.js again, the env functions... is this the one that magically fixed itself? Well it magically broke again
- See you at Exercism express

# Exercism express

- Building out the testing framework.
- It's really a joy now with this app I made! I can pull up any exercise instantly!
- So now when an exercise is loaded, its test suite is evaluated and each `deftest` is stored in a global array called `deftests`.
- Let's look at some examples:
-
  ``` js
	  ["hello-world-test", ["is", ["=", "Hello, World!", ["hello-world/hello"]]]]
	  
	  [['two-fer-test', ['is', ["=", "One for you, one for me.", ["two-fer/two-fer"]]]]
	   ['name-alice-test' ['is', ["=", "One for Alice, one for me.", ["two-fer/two-fer", "Alice"]]]] 
	   ['name-bob-test', ['is', ["=", "One for Alice, one for me.", ["two-fer/two-fer", "Bob"]]]]]
  ```
- How about one with multiple assertions?
- Wait... If I just have `is` evaluate its ast and store the result... but first we need to strip the namespace off the var..
- I think I solved that - it simply ignores the namespace part when looking up in env.
- So when the run tests button is pressed we need to start a new env, evaluate the cell, and evaluate the tests in the same env.
- When it runs the tests it outputs `deftests` as an empty array. It's supposed to have tests in it.
- The env isn't changing.
- OK I figured out what the problem was. I had an extra return statement in deftest
- Got it! And I made a `<span>` that shows the results.
- What I need to do now is make it show which tests failed, and I need to back up because atm it's throwing away that info
- Done! Wow, it actually turned into a good day.
- hmm, but what's up with this?
- ![armstrong-bug.gif](../assets/armstrong-bug_1690052582838_0.gif)
- ah, it's because there are `testing` forms. So it isn't evaluating the `is`
- Fixed it!
- Made regular expressions. That was super easy, I added a check to the `dispatch` special form which I anticipated before, otherwise I'd have just made it "Lambda" or something. So this was easy:
-
  ``` js
	  case "dispatch":
	          if (types._string_Q(a1)) {
	            const re = new RegExp(a1)
	            return re
	          }
	          let fun = [types._symbol('fn')]
	          const args = ast.toString().match(/%\d?/g).map(types._symbol)
	          let body = ast.slice(1)[0]
	          fun.push(args)
	          fun.push(body)
	          return types._function(EVAL, Env, body, env, args);
  ```
- ![image.png](../assets/image_1690068194381_0.png)
- I did this because I was doing acronym
- Having trouble because it needs to be global.
- Let's see how they do it in Clojurescript
-
  ``` clojure
	  (defn- re-seq* [re s]
	    (when-some [matches (.exec re s)]
	      (let [match-str (aget matches 0)
	            match-vals (if (== (.-length matches) 1)
	                         match-str
	                         (vec matches))]
	        (cons match-vals
	              (lazy-seq
	               (let [post-idx (+ (.-index matches)
	                                 (max 1 (.-length match-str)))]
	                 (when (<= post-idx (.-length s))
	                   (re-seq* re (subs s post-idx)))))))))
	  
	  (defn re-seq
	    "Returns a lazy sequence of successive matches of re in s."
	    [re s]
	    (if (string? s)
	      (re-seq* re s)
	      (throw (js/TypeError. "re-seq must match against a string."))))
  ```
- I solved Acronym, but had to make a small modification:
-
  ``` clojure
	  (ns acronym)
	  
	  (defn acronym [text]
	    (if (= text "") ""
	    (->> (re-seq #"[A-Z]+[a-z]*|[a-z]+" text)
	         (map first)
	         (apply str)
	         str/upper-case)))
  ```
- Here is `if-let`:
-
  ``` clojure
	  (defmacro if-let
	    "bindings => binding-form test
	  
	    If test is true, evaluates then with binding-form bound to the value of 
	    test, if not, yields else"
	    {:added "1.0"}
	    ([bindings then]
	     `(if-let ~bindings ~then nil))
	    ([bindings then else & oldform]
	     (assert-args
	       (vector? bindings) "a vector for its binding"
	       (nil? oldform) "1 or 2 forms after binding vector"
	       (= 2 (count bindings)) "exactly 2 forms in binding vector")
	     (let [form (bindings 0) tst (bindings 1)]
	       `(let [temp# ~tst]
	          (if temp#
	            (let [~form temp#]
	              ~then)
	            ~else)))))
  ```
- Which uses:
-
  ``` clojure
	  (defmacro ^{:private true} assert-args
	    [& pairs]
	    `(do (when-not ~(first pairs)
	           (throw (IllegalArgumentException.
	                    (str (first ~'&form) " requires " ~(second pairs) " in " ~'*ns* ":" (:line (meta ~'&form))))))
	       ~(let [more (nnext pairs)]
	          (when more
	            (list* `assert-args more)))))
  ```
- Hit regex stuff. Best inspiration here is the [Clojurescript source](https://github.com/clojure/clojurescript/blob/e7cdc70d0371a26e07e394ea9cd72d5c43e5e363/src/main/cljs/cljs/core.cljs#L10216)
- It begins with `re-matches`:
-
  ``` clojure
	  (defn re-matches
	    "Returns the result of (re-find re s) if re fully matches s."
	    [re s]
	    (if (string? s)
	      (let [matches (.exec re s)]
	        (when (and (not (nil? matches))
	                   (= (aget matches 0) s))
	          (if (== (count ^array matches) 1)
	            (aget matches 0)
	            (vec matches))))
	      (throw (js/TypeError. "re-matches must match against a string."))))
  ```
- # Destructure
	- Check out SCI: https://github.com/babashka/sci/blob/master/src/sci/impl/destructure.cljc
	- Ha. Now I know where those random hashes were coming from in the representer when macroexpanding code.
	- There's obviously no point in starting this until we have `loop`. Regular `loop`, that is
	- Ok cool, so now that loop is basically done, I can start this! I wonder what we'll have to build on the way...
- ## Partition
	- This should be pretty easy, actually. Source:
	-
	  ``` clojure
	  		  (defn partition
	  		    "Returns a lazy sequence of lists of n items each, at offsets step
	  		    apart. If step is not supplied, defaults to n, i.e. the partitions
	  		    do not overlap. If a pad collection is supplied, use its elements as
	  		    necessary to complete last partition upto n items. In case there are
	  		    not enough padding elements, return a partition with less than n items."
	  		    {:added "1.0"
	  		     :static true}
	  		    ([n coll]
	  		       (partition n n coll))
	  		    ([n step coll]
	  		       (lazy-seq
	  		         (when-let [s (seq coll)]
	  		           (let [p (doall (take n s))]
	  		             (when (= n (count p))
	  		               (cons p (partition n step (nthrest s step))))))))
	  		    ([n step pad coll]
	  		       (lazy-seq
	  		         (when-let [s (seq coll)]
	  		           (let [p (doall (take n s))]
	  		             (if (= n (count p))
	  		               (cons p (partition n step pad (nthrest s step)))
	  		               (list (take n (concat p pad)))))))))
	  ```
	- It's recursive. We need `take`.
	- Could kind of use multiarity functions sometime soon.
- # Multi-arity functions
	- The best approach seems, really, to do a more bottom-up approach to get all the pieces in place so we can use Clojure core functions as they are. And this is a high priority.
	- Need to modify interpretation of `defn`.
	- Also needs to support docstrings, but I'll worry about that later.
	- I'm thinking we want to store each arity as a separate function... or maybe not?
	- It would be cool to somehow re-write it into a js function that dispatches on arg length. But I actually can't think of how I'd do that. The only way I can think of is to handle it in the interpreter.
	- First we create list of fn bodies, one for each arity.
	- Then, define each arity as a separate function:
	-
	  ``` js
	  		  const fnName = a1 + "-arity-" + i
	  ```
	- That much works. But then when I run
	-
	  ``` js
	  		  env.set(fnName, fn)
	  ```
	- The env returned is empty.
	- Ah ok it's because `env.set` needs to be passed a symbol.
	- I think I got it! So now I just need to make it work for regular functions again...
	- I completely disabled the previous behavior in order to get it working, so now it's treating every defn as multiarity.
	- I've got it worked out but it's still not working. So close though.
	- I'm not sure if the mistake is in the definition or the call. But regular function calls work, so I guess that settles it...
	- It gets the right answer... but then it tries to evaluate the answer!
	- Hmm. Well I figured that out but now I've got a weirder problem....
	- The multi-arity function works when evaluated, but not in my test runner thingy. Have to see why that would be...
	- I got `Error: 'two-fer' not found`.
	- This is the code:
	-
	  ``` clojure
	  		  (ns two-fer)
	  		  
	  		  (defn two-fer
	  		    ([] (str "One for you, one for me."))
	  		    ([name] (str "One for " name ", one for me.")))
	  		  
	  ```
- Oh, and yes, the previous solution still works.
- Why is it looking for `two-fer` and not the respective arities, like when we call it normally?
- It's not a namespace issue, I just tried it without the declaration.
- Got it! I needed to duplicate the logic that strips the namespace from the function name. Since it does its own check to see if it's a multi-arity function, and it still had the namespace!
- So I think the last thing I need to do before merging this is to get loop working again.
- This might be tricky because it needs to know where the args are
- Loop/recur works. So that's great! No functionality was lost. The only question is if you have a loop/recur inside a multi-arity fn, we might need to handle that special. But for now... I think I'm good to merge!
- # `loop`
	- I know this will probably be so easy, after I take way too long figuring it out.
	- We could start by making `partition`, because we'll want it anyway
	- Here's a little test function:
	-
	  ``` clojure
	  		  (loop [a 3 b []]
	  		    (if (= a 0)
	  		        b
	  		        (recur (dec a) (conj b a))))
	  		  [2 1 0]
	  ```
	- So right now I've got `loop` behaving just like `let`. But I need to implement `recur`.
	- ok I'm trying to wrap my head around this because it's so close but it's not right.
		- 1. `loop` creates a new env called `loop_env` and initializes the bindings in it. It also saves the bindings in an array called `loopvars`
			2. but it's already wrong! Somehow, when it creates the new env, the loop variables are already defined in it???? how can that be???

	- I'm totally confused and I don't like this.
	- I finally found a way to make it work. Here's another one:
	-
	  ``` clojure
	  		  (loop [iter 1
	  		         acc  0]
	  		    (if (> iter 10)
	  		      (println acc)
	  		      (recur (inc iter) (+ acc iter))))
	  		  "55"
	  ```
	- Now this solution to `accumulate` works:
	-
	  ``` clojure
	  		  (ns accumulate)
	  		  
	  		  (defn accumulate [f xs]
	  		    (loop [xs xs
	  		           accum []]
	  		      (if
	  		       (empty? xs) accum
	  		       (recur (rest xs) (conj accum (f (first xs)))))))
	  ```
-
  ``` clojure
	  (defn fact [x]
	    (loop [n x prod 1]
	      (if (= 1 n)
	        prod
	        (recur (dec n) (* prod n)))))
	  
	  (fact 12) => 479001600 
  ```
- Oh, but what about recur without loop?
- whatever passing clause needs to set the loop_env, loopVars, and the loopAST.
- `loop_env`: This has each of the loop variables set in it.
- `loopVars`: in function mode (not in a `loop`) this is simply the args.
- `loopAST`: the function body. See, this isn't hard
- but... where does it get the initial values from? That needs to come from the calling function, not when we're processing the defn or fn or whatever.
- So I think that's where we need to set the vars in the loop_env. When we have access to the initial values. In other words, in the `default` case at the bottom of the interpreter.
- This is the code (in the `loop` case) that sets the loop vars:
-
  ``` js
	  for (var i = 0; i < a1.length; i += 2) {
	            loop_env.set(a1[i], EVAL(a1[i + 1], loop_env))
	            loopVars.push(a1[i])
	          }
  ```
- What is `a1`? the vector of bindings. We traverse them in pairs.
- But here, the args passed in are `el.slice(1)`.
- Wait... this isn't going to work... because it will overwrite the variables when another function is called... what I need is to solve it like I did before, and find some way to know if we're in a loop so we know not to replace `recur`.
- hmm, this is a mind bender. Before, I did it by modifying the actual function when it is defined. But we can't do that... the `recur` needs to be preserved.
- ok I figured it out. We have that function that walks the ast and swaps the `recur` with the function itself. All we need to do it have it *not* do it if it has a `loop` in it! That will be easy enough.
- The last thing I need is recur in a `fn`:
-
  ``` clojure
	  (defn total-of [numbers]
	      ((fn [func elements value]
	      (if (empty? elements)
	        value
	        (recur func (rest elements) (func value (first elements)))))
	       + numbers 0))
	    
	  (total-of [1 2 3])
  ```
- I can't see what the problem is, the ast looks right with this:
-
  ``` js
	  export function _function(Eval, Env, ast, env, params) {
	      console.log("fn AST:", ast)
	      var fn = function () {
	          return Eval(ast, new Env(env, params, arguments))
	      }
	      let swapRecur = postwalk(x => {
	          if (x.value == _symbol("recur")) {
	              return fn
	          } else {
	              return x
	          }
	          return x
	      }, ast)
	      if (!hasLoop(ast)) {
	          ast = swapRecur
	        }
	        console.log("fn AST:", ast)
	      fn.__meta__ = null;
	      fn.__ast__ = ast;
	      fn.__gen_env__ = function (args) { return new Env(env, params, args); };
	      fn._ismacro_ = false;
	      return fn;
	  }
  ```
- The weird part is it works with defn:
-
  ``` clojure
	  (defn compute-across [func elements value]
	      (if (empty? elements)
	        value
	        (recur func (rest elements) (func value (first elements)))))
	  
	  (defn total-of [numbers]
	      (compute-across + numbers 0))
	  
	  (total-of [1 2 3])
	  => 6
  ```
- Wait... this works:
-
  ``` clojure
	  ((fn [func elements value]
	      (if (empty? elements)
	        value
	        (recur func (rest elements) (func value (first elements)))))
	       + [1 2 3] 0)
	  => 6
  ```
- But this doesn't:
-
  ``` clojure
	  (defn total-of [numbers]
	      ((fn [func elements value]
	      (if (empty? elements)
	        value
	        (recur func (rest elements) (func value (first elements)))))
	       + numbers 0))
	    
	  (total-of [1 2 3])
	  => 
	  Error: lst.slice is not a function
  ```
- So this is a big clue! But what could it mean?
- My guess is that in the case with the `defn`, it's replacing the `recur` with... the wrong function, i.e. the outer one. But I'm not quite wrapping my head around it.
- This problem merits an issue...
- # Sets
	- So the time has come to learn how the reader works! I can't believe I've avoided it until now.
	- Say we input a test expression, `#{"a" 1}`.
	- First `read_str` calls `read_form` passing it a new Reader which is passed its tokens `['#', '{', '"a"', '1', '}']`
	- Got it done, but I had to modify the reader, including the tokenizer to recognize `#{` as an opening token.

- So now that multiarity functions work, we can try to work through the Clojure source. Slowly, obviously. Because there will doubtlessly be half a dozen other things that won't work at every step...
- # When-let
	- This is a macro. It needs to only evaluate the body if the test is true.
	- Haha this is the best way to get me to actually learn everything
	-
	  ``` clojure
	  		  (defmacro when-let
	  		    "bindings => binding-form test
	  		  
	  		    When test is true, evaluates body with binding-form bound to the value of test"
	  		    {:added "1.0"}
	  		    [bindings & body]
	  		    (assert-args
	  		       (vector? bindings) "a vector for its binding"
	  		       (= 2 (count bindings)) "exactly 2 forms in binding vector")
	  		     (let [form (bindings 0) tst (bindings 1)]
	  		      `(let [temp# ~tst]
	  		         (when temp#
	  		           (let [~form temp#]
	  		             ~@body)))))
	  ```
	- So first we need `assert-args`
	-
	  ``` clojure
	  		  (defmacro ^{:private true} assert-args
	  		    [& pairs]
	  		    `(do (when-not ~(first pairs)
	  		           (throw (IllegalArgumentException.
	  		                    (str (first ~'&form) " requires " ~(second pairs) " in " ~'*ns* ":" (:line (meta ~'&form))))))
	  		       ~(let [more (nnext pairs)]
	  		          (when more
	  		            (list* `assert-args more)))))
	  ```
	- There seems to be a critical difference in how macros work.
	- In mine, the body needs to be inside a function:
	-
	  ``` clojure
	  		  (defmacro when (fn [x & xs] (list 'if x (cons 'do xs))))
	  ```
	- But in Clojure it's done implicitly:
	-
	  ``` clojure
	  		  (defmacro when [test & body] (list 'if test (cons 'do body)))
	  ```
	-
	  ``` js
	  		  case 'defmacro':
	  		          var func = types._clone(EVAL(a2, env));
	  		          func._ismacro_ = true;
	  		          return env.set(a1, func);
	  ```
	- So yes, it doesn't define a function, rather it clones one. Let's see if we can change that.
	- It keeps getting deeper. for assert-args, we need this:
	-
	  ``` clojure
	  		  (defn spread
	  		    {:private true
	  		     :static true}
	  		    [arglist]
	  		    (cond
	  		     (nil? arglist) nil
	  		     (nil? (next arglist)) (seq (first arglist))
	  		     :else (cons (first arglist) (spread (next arglist)))))
	  		  
	  		  (defn list*
	  		    "Creates a new seq containing the items prepended to the rest, the
	  		    last of which will be treated as a sequence."
	  		    {:added "1.0"
	  		     :static true}
	  		    ([args] (seq args))
	  		    ([a args] (cons a args))
	  		    ([a b args] (cons a (cons b args)))
	  		    ([a b c args] (cons a (cons b (cons c args))))
	  		    ([a b c d & more]
	  		       (cons a (cons b (cons c (cons d (spread more)))))))
	  ```
	- So there's a problem with our multiarity handling that prevents the variadic arity being called.
	- Besides that, it *almost* works:
	-
	  ``` clojure
	  		  (list* 1 2 [3 4])
	  		  => (1 2 [3 4] nil)
	  ```
	- The `nil` should not be there. Which doesn't make sense because the first arity just calls seq on the args, which works:
	-
	  ``` clojure
	  		  (seq [3 4])
	  		  => (3 4)
	  ```
	- We have the basic variadic functionality:
	-
	  ``` clojure
	  		  (defn yo [a & more]
	  		    [a more])
	  		  
	  		  (yo 1 2 3 4 5)
	  		  => [1 (2 3 4 5)]
	  ```
	- Which means that if we look for an `&` in the arglist, we could define it as `<function>-variadic`, and find it when it's called likewise.
	- Continue this in section below
- # `core.clj`
	- I kind of want to start a proper thing now. Do we have load-file?
	- no, actually `slurp` doesn't even work. But I thought it did...
	- God this is so annoying. I think I'm gonna give up because this is so stupid.
	- The only lead I have is to do something like what I did for the download feature in MECCA:
	-
	  ``` clojure
	  		  [:button
	  		         {:on-click #(let [file-blob (js/Blob. [@(subscribe [:notes])] #js {"type" "text/plain"})
	  		                           link (.createElement js/document "a")]
	  		                       (set! (.-href link) (.createObjectURL js/URL file-blob))
	  		                       (.setAttribute link "download" "mecca.txt")
	  		                       (.appendChild (.-body js/document) link)
	  		                       (.click link)
	  		                       (.removeChild (.-body js/document) link))}
	  		         "Download"]
	  ```
	- This makes me think that it could be possible to do the opposite. I just found the code somewhere and it seems sufficiently hacky, i.e. it accomplishes something that afaict shouldn't be possible. It makes a fake link and automatically clicks it.
	- I don't think I feel like doing this now because I'm ultra pissed and was sort of happy working on my actual project. I just thought it would be nice to not have to evaluate code using 100 calls to `evalString`, but alas.
- # Multi-arity with variadic
	- I took a peek at how SCI does it: https://github.com/babashka/sci/blob/master/src/sci/impl/fns.cljc
	- Here's the basic idea:
	-
	  ``` clojure
	  		  (defn fn-arity-map [ctx enclosed-array fn-name macro? fn-bodies]
	  		    (reduce
	  		     (fn [arity-map fn-body]
	  		       (let [f (fun ctx enclosed-array fn-body fn-name macro?)
	  		             var-arg? (:var-arg-name fn-body)
	  		             fixed-arity (:fixed-arity fn-body)]
	  		         (if var-arg?
	  		           (assoc arity-map :variadic f)
	  		           (assoc arity-map fixed-arity f))))
	  		     {}
	  		     fn-bodies))
	  ```
	- I just tried to break out the function stuff into a separate module to organize the project better, but I couldn't get it to work. Another annoying fail, that's 2 today. Like ok, I'll just have this giant pile of shit
	- Anyway. Is there allowed to be more than one arity that is variadic? I need to find out.
	- I didn't find the answer in the docs. I might have missed it. But it only took 10 seconds at the repl:
	-
	  ``` clojure
	  		  (defn a
	  		    ([] "no args")
	  		    ([x] x)
	  		    ([x y] (str x y))
	  		    ([x y & more] (str x y "and" (apply str more)))
	  		    ([x y z & more] (str x y z "and" (apply str more))))
	  		  ; clojure.lang.ExceptionInfo: Can't have more than 1 variadic overload user
	  ```
	- So there we go! That makes it easier, because all we have to do is look for the `&`.
	- Got it! The definition part, anyway. Now I need to handle calls.
	- ![image.png](../assets/image_1690452072921_0.png)
	- Alright! That went surprisingly well!
- # Testing (CI)
	- So I figured out why the tests have been broken... though I don't understand why.
	- I remember noticing when the env is printed to the console, certain symbols are undefined but I was unable to discern any pattern. Well, it turns out the ones that failed to load are the ones from types.js. But it doesn't make sense why those functions aren't available. It does work, however, if I simply copy the function into the core module! Whaaaat?
	- OK so now it's failing because it is looking for plain old simple `two-fer`, and not the appropriate arity... which are properly defined in the env - I can plainly see that. Why would it be doing that? The lookup logic is built into the interpreter. Let's see what we can debug.
	- It correctly outputs `fn has no docstring and is multi-arity`
	- Could there be a bug in my calling logic? If so, it should also fail in the editor...
	- Aha! It does fail!
	- I see what the problem is. The logic is incomplete.
		- It first checks if there is a variadic arity defined
		- if there is, then check if there's a fixed arity that matches
		- otherwise we call the variadic function
		- but... we then need to recheck if there's a fixed-multiarity! Derp
		- Got it!
	- Cool, so now I've completed the workflow that I was aiming for when I started this Exercism Express thing in the first place. I wanted a way to help guide the process of working towards the goal of being able to use it for solving exercises as if it is Clojure. And I can't think of any better way to test the thing, either. All the example solutions are idiomatic Clojure, using pretty much, the most commonly used functions. Match made in heaven.
