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
- So now I've got a clear development trajectory, but I haven't chosen a logical order to work through the exercises. I did two-fer and hello world, and right now I'm working on diamond, for no particular reason except that it's at the top of the json file. Why is that? I thing it's just the order that java.io listed the directories!
- you know what I could do... process the config.json and sort them by difficulty. Sounds like a plan!
- I can just loop through each integer from 1 to 10 and list the exercises that match each difficulty. simple.
- Cool, so that's done. There's 4 exercises at level 1:
	- [ 'two_fer', 'armstrong_numbers', 'hello_world', 'reverse_string' ]
	- Ha. Armstrong numbers should not be in that. In my PR I changed it to 4, which seems right.
	- I'll take a little detour and come up with a way to compute them objectively.
	- If we make a sliding scale between the highest and lowest completion rate, and place them on the curve.
	- the lowest is go counting, at 35%. Highest is 93%.
	- so if we consider go counting a 10, we can subtract 35 from 93 and we get 58.
	- Anagram is 93, which is 0.
	- Here's my formula:
	-
	  ``` clojure
	  		  (defn difficulty [rate]
	  		    (int (/ (- 93 rate) 5.5)))
	  ```
	- Let's do it!
	- The formula puts Armstrong Numbers at 5. Excellent!
	- reverse-string is failing and look at this:
	-
	  ``` clojure
	  		  (defn reverse-string
	  		    ([word] (s/reverse word)))
	  ```
	- Who did that? I mean, there shouldn't be a problem with it. But it seems to have revealed a deeper bug: the function being defined is `reverse-string-arity-0`, but it's an arity 1... and the function being called is... plain, simple `reverse-string`. What's the deal?
	- And when I change it to the function as it would commonly be... it goes into an infinite loop!
	- An additional side problem has also emerged. It uses `s/reverse`, from the `clojure.string` namespace, which reverses a string. Eventually I can fix this by actually parsing the ns requires and doing real namespaces. That won't even be that hard. But one thing at a time. Why tf would it save a 1-arity as a 0-arity? Do we not go by the length of the arglist? That would be pretty dumb if it was by index, i.e. in order of fn bodies. I hope I didn't do that.
	- omg I did
	- I didn't mean to though... I had
	-
	  ``` js
	  		  fnName = types._symbol(a1 + "-arity-" + i)
	  ```
	- instead of
	-
	  ``` js
	  		  fnName = types._symbol(a1 + "-arity-" + args[i].length)
	  ```
	- I won't tell anyone if u don't
	- wait, that's not even right
	- it's `fnName = types._symbol(a1 + "-arity-" + args.length)`
	- ok so now the function is being assigned correctly.
	- But it's not looking for the correct function.
	- Wait... only the final test is messing up
	-
	  ``` clojure
	  		  (deftest long-string-test
	  		    (let [s (reduce str "" (repeat 1000 "overflow?"))
	  		          rs (reduce str "" (repeat 1000 "?wolfrevo"))]
	  		      (is (= rs (reverse-string/reverse-string s)))))
	  ```
	- I don't see what the problem is.
	- whoa... it works if I remove the let, like this:
	-
	  ``` clojure
	  		  (deftest long-string-test
	  		      (is (= (reduce str "" (repeat 1000 "?wolfrevo")) 
	  		            (reverse-string/reverse-string 
	  		              (reduce str "" (repeat 1000 "overflow?"))))))
	  ```
	- That's an awfully weird bug.
	- Now, when I fix the last test, the empty string test is failing, even though it evaluates fine in the editor. Kind of confused here on this one.
	- It gets weirder. When I comment out the one failing test, the next one fails. How fuuuuunnn
	- So, there's definitely something funny going on. Something about the test runner logic or something, because the code is all fine
	- Hmm, actually the deftests variable shows *every* test failing in reverse string
	- I might need to import the regular eval function so we can execute each one in its own env. I can see now that the tests are not being cleared like they should.
	- omg I did it! that was the whole problem. I didn't even change the env though, all I did was add my `cleartests()` function which I forgot I wrote
	- um... now the tests are passing, but you can clearly see *failing* tests in the deftests report... I think maybe I should rest from this. It's getting really fuzzy.
	- I've been working on this for like... over 24 hours or some shit. It's 1:30 PM
- # Testing bug, continued
	- So, for some reason the reverse-string test results are showing false, even though the fails vector is empty, so something is not working properly.
	- So I'm going to go through the system from the bottom up and see if I can make it better.
	- I'm going to move all the testing logic into the test file, and start a fresh env like it should.
	- I don't know what's up with the testing workflow. I had to copy over the entire types module into core because *it refuses to import them*!
	- Now I have all the functions available in the test env except for read string, for which I need to copy over the reader stuff too. What a confusing mess! Why would it not be able to import them?
	- It might be an issue with paths... that might explain it. But we're importing from `"../src/interpreter"` in the test module, which imports from everything else, including core. So why wouldn't the same functions from types be available to core as they're available to the interpreter, and why is it only broken in the tests? Plus that means I can trusts the tests less because they're using different code copied from another place! But when I tried to actually eliminate the types module, the entire app broke. This sucks.
	- It seems that EVAL is not working.
- # Webdriver tests
	- I'm kind of desperately squirming, nothing seems to work. What if I try doing the browser tests like in the lang-clojure-eval project?
	- I got the testing browser window opening up now... but I'm getting a strange error: `ReferenceError: Cannot access '__vi_esm_0__' before initialization`
	- I'm immediately stuck. Maybe I'll start with my working template and try to switch out the interpreter?
	- Or, just not worry about testing if it's causing a whole series of headaches?
	- Yep.... blah. I hate this shit.
	- Maybe I could build a test feature into the app itself? That might just be the best idea. Because... the application *is a test runner*
	- It works! What a great idea!!!!
	- Now I can focus on actually building the app

- Alright, so the following exercise tests are passing:
	- 1. hello world
		2. two-fer
		3. reverse string
		4. accumulate
		5. series
		6. robot_name
		7. anagram
		8. triangle
		9. word_count
		10. armstrong_numbers
		11. difference_of_squares
		12. roman_numerals

- Which one should I try next?
- Series requires `set`. I can implement that.
- Cool, the problem was that `arguments` is already an array, with the actual args as the first element.
- Now I'm dealing with an issue where equals is not working like it should.
- Wait... it's because when I changed `set` to use the first of the args, it broke the set literals! How annoying!
- I think I'll have to make another function called `toSet`.
- ok done. But there's also a bug in equals, which is... it's not implemented on sets yet!
- Alright, that was easy! It's handled the same as list and vector.
- Now up to `robot-name`. We need:
	- `repeatedly`
	- `format`
	- `rand-nth` ✅
	- `rand-int` ✅
- `format` is a huge can of worms. I could try using a library... actually, I found a stack overflow solution that seems to work well enough... or maybe not
- Paula Gearon wrote a Clojurescript implementation: https://github.com/quoll/clormat
- This is really good! And there's good tests to follow. What a great find. It was on clojuredocs. See you at format
- hahaha, so I realized that often times it's easier to modify the solutions than to add features to my language, so I skipped format.
- Now I ran into a keyword as a function. it would be cool to implement that!
- I'm getting some kind of bug with atoms.
- # Chars
	- I want to support character literals, i.e. `\A`. Obviously javascript doesn't have them, but I should be able to read them and treat them as single character strings.
	- I got it! First, in the reader:
	- Add this to `read_atom`:
	-
	  ``` js
	  		   } else if (token[0] === "\\") {
	  		          return _char(token[1]);
	  ```
	- In types, add this to `_obj_type`
	-
	  ``` js
	  		   else if (_char_Q(obj)) { return 'char'; }
	  ```
	-
	  ``` js
	  		  // Chars
	  		  export function _char(obj) {
	  		      if (typeof obj === 'string' && obj[0] === '\\') {
	  		          return obj;
	  		      } else {
	  		          return "\\" + obj
	  		      }
	  		  }
	  		  
	  		  export function _char_Q(obj) {
	  		      return typeof obj === 'string' && obj[0] === '\\';
	  		  }
	  ```
	- Pretty sure that's it. Great! Much easier than I thought it might be. I thought I might have to modify the tokenizer, but I saw that it indeed matched as long as it was escaped properly in the code. Now I just need to figure out what I need to do with them.
	- The place I remember seeing them was in expressions like `(int \A)`, to coerce a char to an int. I could implement that.
- # Regex bug (`re-seq`)
	- This returns nil:
	- `(re-seq #"[A-Z]{2}\\d{3}" (robot-name (robot)))`
	- Same if it's called directly on a string: `(re-seq #"[A-Z]{2}\\d{3}" "JN081")`
	- oh... it comes up as `nil` in clojurescript as well...
	- This one fails, but works in cljs: `(re-seq #"\d" "clojure 1.1.0")`. It returns `Error: Cannot read properties of null (reading '0')`
	- Also this `(re-seq #"\w+" "mary had a little lamb")`
	- Clearly there's something messed up.
	- I fixed the regex (sort of) by just using the output of `re.exec(s)`. But I'm getting very strange behavior, like it works sometimes but not others. It's confusing because it works if I evaluate everything in order, but not in the actual tests. It's very weird. It gives me `Error: f.apply is not a function` unless I actually evaluate the forms in order, and when I run the tests, it somehow loses the definitions. very weird!
	- I did have to modify the `is` function, because it wasn't doing the right thing.
	- It seems like when there's a `let`, it loses the definitions in the env.
	- Wait, no... it's the `deftest`. That's much better, I don't want there to be a flaw in the env
	- This is the repro:
	-
	  ``` clojure
	  		  (def letters (map char (range 65 91)))
	  		  
	  		  (defn generate-name [] 
	  		     (apply str (concat (repeatedly 2 (fn [] (rand-nth letters)))  
	  		        (repeatedly 3 (fn [] (rand-int 10))))))
	  		  
	  		  (defn robot []
	  		    (atom {:name (generate-name)}))
	  		  
	  		  (defn robot-name [robot]
	  		    (get (deref robot) :name))
	  		  
	  		  (deftest robot-name
	  		    (let [a-robot (robot-name/robot)
	  		          its-name (robot-name/robot-name a-robot)]
	  		        (is (re-seq #"[A-Z]{2}\\d{3}" its-name))))
	  ```
	- If I take away the deftest and leave the inner let, it all works.
	- I confirmed that this fails as well:
	-
	  ``` clojure
	  		  (deftest robot-name
	  		    (is (re-seq #"[A-Z]{2}\d{3}" (robot-name (robot)))))
	  ```
	- Somehow, the `deftest` makes it forget the definitions. Once you evaluate it, everything else is wiped out, at which point even this won't work: `(robot-name (robot))`
	- It works with this deftest commented out, but fails if uncommented:
	-
	  ``` clojure
	  		  #_(deftest robot-name
	  		    (is true))
	  		  
	  		  (robot-name (robot))
	  ```
	- So.... that's the minimal repro.
	- Why this deftest? We've used it on dozens of forms already and the only thing I can think of that's new is the atoms, so, it would stand to reason that it's the problem.
	- I could "cheat" and figure out how to do it without atoms. But no, I need to figure out what the problem is.
	- Waaaat. I took away the atom and it still breaks.
	- omg. I sure feel dumb now... it's because the test is named the same thing as the var. Holy shit! I should come up with a way to save it as a variation
- Robot name passes now!
- I had to shuffle the exercises array to get a new exercise. I got anagram. It needs `sort`, which should be really simple... wait... we do have sort! Aha. It's not implemented on strings!
- we need `and`... done! now anagram works!
- I just found `some`:
-
  ``` clojure
	  (def some
	    (fn (pred xs)
	      (if (empty? xs)
	        nil
	        (or (pred (first xs))
	            (some pred (rest xs))))))
  ```
- That made 1 more exercises pass, `triangle`! Now there's 8.
- Looking at `word-count`. Giving the ol' `TypeError: Cannot read properties of null (reading '0')`.
- We need `split`. An alternate approach in the tests uses `frequencies` and `re-seq`. `frequencies` sounds fun, actually
- # `frequencies`
	-
	  ``` clojure
	  		  (frequencies ['a 'b 'a 'a])
	  		  {a 3, b 1}
	  ```
	- First try!
	-
	  ``` clojure
	  		  (frequencies ['a 'b 'a 'a]) => {"a" 3 "b" 1} 
	  ```
- There's a problem with the regular expression syntax, because the slashes require escaping due to the normal reading process I guess.  Is there a way we could fix this, specifically for regex?
- Got it!
- # `re-seq` continued
	- So I never figured this out.
	- I want to make it behave like Clojure, where the slashes don't need to be escaped. But any unescaped slashes are already swallowed by the time they are interpreted.
	- ok, I think I've got it figured out... but the slashes need to be escaped, there doesn't seem to be any other way. And if the regex comes from a file, there needs to be 4 slashes so that it will be 2 in the user code.
- Word count is solved!
- # `distinct?`
	- I implemented this using a javascript set, but there's a problem: it doesn't recognize symbols as distinct.
	- What I'll do is implement `distinct`, and have it use that. That way I can hopefully allow for the edge cases.
	- The `=` function does the right thing. So I'll just loop through it and check every element.
	- fuck. No matter what I try it... well, it recognizes duplicate symbols... and then puts them in the new coll anyway! wtf?!?
	- Here's the Clojure impl:
	-
	  ``` clojure
	  		  (defn distinct [coll]
	  		     (let [step (fn step [xs seen]
	  		                  (lazy-seq
	  		                    ((fn [[f :as xs] seen]
	  		                       (when-let [s (seq xs)]
	  		                         (if (contains? seen f)
	  		                           (recur (rest s) seen)
	  		                           (cons f (step (rest s) (conj seen f))))))
	  		                     xs seen)))]
	  		       (step coll #{})))
	  ```
	- I'm pissed. Think I'd better move on before I want to break something.
- # Triangle
	- This exercise is taking awhile. It's the only one that visibly hangs, all the others are evaluated extremely quickly. Let's see what's up.
	- Weird... it doesn't look like such a big deal. It's just a bunch of comparisons. How anticlimactic. But indeed... the test run takes a few seconds by itself.
	- There's a benchmark thingy, isn't there?
	- Added `time`. It prints the elapsed time to the console, because I don't know how to print 2 return values. And it only took 2265msecs.
	- Here's the weird part - the actual computations, without the testing part, took only 293msecs. I'm confused. Don't the other exercises have just as many test assertions? They're only checks of `true?` or `false?`.
	- There's 20 of them. Let's say I make all the functions just return true.
	- 2msecs! So wtf... it's not the testing stuff, and it's not the calculations. It's a paradox!
- # Finally... `core.clj`
	- I finally got load-file working! But... will it work in prod? Let's find out...
	-
	  ``` clojure
	  		  (load-file "src/core.clj")
	  		  myvar => "this is my var" 
	  ```
	- In order for the static asset to be available in prod it needs to be imported, but it can't because it contains undefined vars or something
	- omg, I just found the answer... in the docs https://vitejs.dev/guide/assets.html#importing-asset-as-string
	- this is the solution:
	-
	  ``` js
	  		  import core from './src/core.clj?raw'
	  ```
	- OMG it works! Holy shit!!!
	- One small issue is quotes have to be double-escaped.
	- I've got all the code moved over and it works great! Feels great... I'd been stuck on this problem for weeks.
- # Destructuring
	- I'm like delusional or masochistic if I think I'm gonna do this right now, but it's worth examining how it even works.
	- Input: `(destructure* '[[a b] [1 2]])`
	- Output:
	-
	  ``` clojure
	  		  [vec__461
	  		   [1 2]
	  		   a
	  		   (#object[clojure.core$nth 0x75cd3577 "clojure.core$nth@75cd3577"] vec__461 0 nil)
	  		   b
	  		   (#object[clojure.core$nth 0x75cd3577 "clojure.core$nth@75cd3577"] vec__461 1 nil)]
	  ```
	- Those weird looking things... are nothing more than the `nth` function. The final vector is output by: `(list nth gvec n nil)`
	- So it's really just this:
	-
	  ``` clojure
	  		  [vec__461 [1 2] 
	  		   a (nth vec__461 0 nil)
	  		   b (nth vec__461 1 nil)]
	  ```
	- ok, I think I get it! It just expands it to a regular let binding!
	- So, don't tell anyone, but... I think I can make the code much cleaner. Sure, it works, put it's a scary mess. I've got a style, it might seem very amateur, because it is, but that isn't a bad thing. I want it to be understandable, like all the rest of my code.
	- I'm thinking I could get the basic case covered first.
	- ## Destructuring `destructure` (haha)
		- So I broke it out into 2 functions, so it's slightly tamed.
		- Broke out another function. If I keep doing this, it might make sense!
		- I wonder if these functions are inlined for performance? That would make sense. So what I'm doing is disassembling.
		- Great! It's all functions that I can see on one screen.
		- So what is this process business? Like, what are we processing?
		- `pb` might be process builder? It becomes `process-entry`, which is a reducing function.
		- Eh... I broke it somehow by tearing it apart. It worked with a simple vector, but failed when I tried destructuring a map.
		-
	- In the cljs source I found this:
		-
		  ``` clojure
		  			  (defn seq-to-map-for-destructuring
		  			    "Builds a map from a seq as described in
		  			    https://clojure.org/reference/special_forms#keyword-arguments"
		  			    [s]
		  			    (if (next s)
		  			      (.createAsIfByAssoc PersistentArrayMap (to-array s))
		  			      (if (seq s) (first s) (.-EMPTY PersistentArrayMap))))
		  ```
	- Here's the destructuring test suite: https://github.com/clojure/clojurescript/blob/6aefc7354c3f7033d389634595d912f618c2abfc/src/test/cljs/cljs/destructuring_test.cljs#L9
	- Somehow... I fixed map destructuring. But idk what I did... I was just noodling around, and now it works:
	-
	  ``` clojure
	  		  (def client {:name "Super Co."
	  		               :location "Philadelphia"
	  		               :description "The worldwide leader in plastic tableware."})
	  		  
	  		  (destructure '[{name :name
	  		                  location :location
	  		                  description :description} client])
	  ```
	- Output:
	-
	  ``` clojure
	  		  [map__13417 client
	  		   map__13417 (if (seq map__13417)
	  		                  (clojure.core/seq-to-map-for-destructuring map__13417)
	  		                   map__13417)
	  		   name (get map__13417 :name)
	  		   location (get map__13417 :location)
	  		   description (get map__13417 :description)]
	  ```
- Related to the editor, not the interpreter: It would be nice to implement slurp and barf
- Starting Clojure interpreter notes page 4
-
- # Zippers!
	- The only thing I need is keyword functions. Let's try that!
	- Done! And I added everything else necessary to solve the zipper exercise!
	- Made it into a separate library, and made a primitive require system.
- # Lazy sequences
	- Here's where I might be able to benefit from a library. This looks really good: https://github.com/beark/lazy-sequences
	- But I don't know how I can use it. There's an `iterate` method that takes an arbitrary function and produces a lazy seq. But how do I get from that to being able to pass a potentially infinite sequence to it?
	- Clojurescript implements them using protocols. And I have an implementation of protocols! It's from Chouser: https://gist.github.com/Chouser/6081ea66d144d13e56fc
	- I says it's a "sketch"... so I'm not sure how complete it is. There is a working example!
	- I'm learning about JavaScript's generators, which might be able to accomplish this natively.
	- How about immutable.js? That has lazy seqs, and probably a bunch more stuff we could use.
	- I implemented `range` to use immutable.js's Range objects. Now I have to make all the things use it.
	- Infinite sequences work!
	-
	  ``` clojure
	  		  (take 4 (range))
	  		  => (0 1 2 3)
	  ```
	- The weird thing is, I didn't even have to modify `take` for that to work. `take` uses normal `slice()`.
	- The tests are making the whole page crash. It was on `armstrong-numbers` when it got stuck:
	-
	  ``` clojure
	  		  (defn expt [base pow]
	  		    (reduce * 1 (repeat pow base)))
	  		  
	  		  (defn armstrong? [n]
	  		    (let [digits (map #(read-string (str %)) (str n))
	  		          l      (count digits)]
	  		      (= n (reduce + 0 (map #(expt % l) digits)))))
	  ```
	- The problem is in this solution - just need to track down exactly what.
	- oooh, elusive. It doesn't fail if I eval it in pieces. I suspect something is failing because a seq is printing a list, but doesn't behave like one.
	- Ah. The output of `count` is wrong. well, not wrong... but the seq cannot apparently be counted the way `count` is doing it.
	- Well I got it so it doesn't hang anymore... it just fails
	- Fixed it! There are several other exercises that are failing now that were passing before. I'll have to figure out which ones
	- These ones are passing:
	- 1. armstrong_numbers',
		2. 'two_fer',
		3. 'grains',
		4. 'word_count',
		5. 'difference_of_squares',
		6. 'hello_world',
		7. 'robot_name'
		8. , 'roman_numerals']

	- And here is the previous list:
	- 1. hello world
		2. two-fer
		3. reverse string
		4. accumulate
		5. series
		6. robot_name
		7. anagram
		8. triangle
		9. word_count
		10. armstrong_numbers
		11. difference_of_squares
		12. roman_numerals

- uh... and there were 3 more too. alas, I forget. Well my documentation may be thorough but it's not perfect
- Got reverse-string working again. Also accumulate. I think I'll go ahead and merge this branch.
- I failed to realize that Clojure's `loop` macro could simply be used without destructuring! How did I not think of that? It's just a matter of replacing `(destructure bindings)` `bindings`:
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
- On the other hand, our `recur` is built into the interpreter, as a special form. I'm sure there's a way to make it work.
- Since there's no laziness, that's what is throwing up the biggest challenge right now. `interleave` has showed up a bunch.
- I could still implement them recursively, but would need to add a stop condition to prevent infinite loops.
-
  ``` clojure
	  (defn interleave
	    "Returns a lazy seq of the first item in each coll, then the second etc."
	    {:added "1.0"
	     :static true}
	    ([] ())
	    ([c1] (lazy-seq c1))
	    ([c1 c2]
	       (lazy-seq
	        (let [s1 (seq c1) s2 (seq c2)]
	          (when (and s1 s2)
	            (cons (first s1) (cons (first s2) 
	                                   (interleave (rest s1) (rest s2))))))))
	    ([c1 c2 & colls] 
	       (lazy-seq 
	        (let [ss (map seq (conj colls c2 c1))]
	          (when (every? identity ss)
	            (concat (map first ss) (apply interleave (map rest ss))))))))
  ```
- I just did the 2-arity, with a `loop`:
-
  ``` clojure
	  (defn interleave [c1 c2]
	    (loop [s1  (seq c1)
	           s2  (seq c2)
	           res []]
	      (if (or (empty? s1) (empty? s2))
	        res
	        (recur (rest s1) 
	               (rest s2) 
	               (cons (first s1) (cons (first s2) res))))))
  ```
- I just hope the other functions I want to implement don't use it in the other arities
- ![image.png](../assets/image_1690815314350_0.png){:height 427, :width 747}
-
  ``` clojure
	  (require "zip")
	  
	  (def tree 
	    {:value 1, 
	     :left {:value 2, 
	            :left nil, 
	            :right {:value 3, 
	                    :left nil, 
	                    :right nil}}, 
	     :right {:value 4, 
	             :left nil, 
	             :right nil}})
	  
	  (-> tree
	      zip/from-tree
	      zip/left
	      zip/right
	      zip/value) => 3 
  ```
- Next: Clojure interpreter notes page 5

- ## Immutable.js
	- I bet I could make very good use of my time by simply porting functions from the immutable.js library. It's got so much!
	- I've got lists and maps, but sets aren't working.
	- I guess the more important part is implementing all the seq methods.
	- Oh, so we don't currently handle hashmaps with integer keys. Let's do that.
	- It's creating the map, but then doing something to it that is wrong. Got to trace through everything it touches.
	- I think I got it. It was the printer.
	- It works, but need to fix its printer:
	-
	  ``` clojure
	  		  (hash-map ["a" 1] ["b" 2])
	  		  => Map { "a": 1, "b": 2 }
	  ```
	- That's as close as it wants to get... what if I turn it into a seq? Idk if I tried that
	- I got it! Came up with a solution using `interleave`:
	-
	  ``` clojure
	  		  case 'hash-map':
	  		       var ret = obj.keySeq().interleave(obj.valueSeq()).join(' ')
	  		       return "{" + ret + "}"
	  ```
	- The only problem is, there are no commas separating the map entries. Oh well, I'll fix it later
	- Wait, there is a slightly bigger problem, that the kvs are supposed to be passed to hash-map individually, not in pairs. So, what we need is to pass it through partition 2. I'll port more functions and I imagine it will start to take shape.
	- Did we do interleave yet? I just woke up.
	-
	  ``` clojure
	  		  (interleave (list [1 2 3]) (list ["a" "b" "c"]) (list ["d" "e" "f"]))
	  ```
	- I can get it working with 2 lists, but not more because I can't figure out the apply syntax... nothing is working
	- omg I got it! Here is what worked:
	-
	  ``` js
	  		  function interleave() {
	  		      var args = Array.prototype.slice.call(arguments, 1)
	  		      var ret = arguments[0].interleave.apply(arguments[0], args)
	  		      console.log("interleaving", ret)
	  		      return ret
	  		  }
	  ```
	- wow. that was annoying. but now I know how to do it. I was missing the `this` arg to apply, because that's stupid. but it won't bee torturing me anymore because I know its secrets
	- Oh, there is a `partition`. If I get that working I can use it for `hash-map` so we don't have to pass it vectors.
	- wtf I don't understand the syntax. It seems to want a predicate. what is this supposed to mean
	-
	  ```
	  		  partition<F, C>(
	  		    predicate: (this: C, value: T, index: number, iter: this) => boolean,
	  		    context?: C
	  		  ): [List<T>, List<F>]
	  		  partition<C>(
	  		    predicate: (this: C, value: T, index: number, iter: this) => unknown,
	  		    context?: C
	  		  ): [this, this]
	  ```
	- what am I looking at? what is `F`? what is `C`? Is `partition` not what I think it is? why is this not documented better?
	- I want to call `(hash-map "a" 1 "b" 2)`.
	- omg, that was so awful but I finally got it
	-
	  ``` clojure
	  		  (hash-map "a" 1 "b" 2 "c" 3)
	  		  => {a 1 b 2 c 3}
	  ```
	- This is the stupid function:
	-
	  ``` js
	  		  export function _hash_map() {
	  		      let args = []
	  		      for (let i = 0; i < arguments.length; i+=2) {
	  		          args.push([arguments[i], arguments[i+1]])
	  		      }
	  		      return Map(args)
	  		  }
	  ```
	- Why was that so hard?? because I hate everything. First, I forgot the `=` in `i+=2` and couldn't understand why it was hanging the browser. Then, I thought I'd need to use `apply` but apparently not... the function takes a single list and not a series of args like I thought.
	- Print hashmaps with commas. This also was much more annoying than I wish it was
	-
	  ``` js
	  		  case 'hash-map':
	  		              let kvstring = obj.keySeq().interleave(obj.valueSeq()).join(' ')
	  		              let kvs = kvstring.split(' ')
	  		              let hmstring = ""
	  		              for (let i = 0; i < kvs.length; i++) {
	  		                  if (i % 2 === 0) {
	  		                      hmstring = hmstring + kvs[i] + ' '
	  		                  } else if (i === kvs.length-1) {
	  		                      hmstring = hmstring + kvs[i]
	  		                  } else {
	  		                      hmstring = hmstring + kvs[i] + ', '
	  		                  }
	  		              }
	  		              return "{" + hmstring + "}"
	  ```
- Wait, so there's a problem with the namespace issue that I thought I had elegantly solved in the last PR. It's because if a symbol is not found, it causes an error. So... maybe we make real namespaces?
- Oh hold on, I do have a way to check if the var exists in the env.
- So, do I really want vars called `user/whatever`? Yes, I suppose we do. That *is* how Clojure does it. Weird that I hadn't caught that yet.
- The value we print for the user even claims that:
- `"Defined: #'hello-world/hello"`
- # Namespaces
	- What I need is a function called `resolve` which contains the lookup logic, because we have to use it in several places, for every way of defining vars, and all the different types of functions.
	- I first removed the var lookup logic from the env module. It only does lookup in the different scopes.
	- So do we use resolve for *defining* the var? or just when calling it?
	- Just when calling it.
	- But, does it return a symbol or a string? Operations following it seem to want a symbol so let's try that
- Something's wrong and I'm having trouble finding it.
- Wow, I got it. It wasn't calling functions properly after resolving them.
- This is the proper call:
- `f = EVAL(resolve(ast[0].value, env), env)`
- Now it's failing on multi-arity functions because it switches the env to outer. Which means my resolve function needs to look there too, and not just in `data`...
- ok so I did that, but now there's another issue I think I realized. Our method of checking if the var is multiarity no longer works, because the name has not yet been resolved to a symbol. And we can't pass it to resolve as it is, because resolve doesn't know to look for multiarity functions! Let's fix that.
- I got a little closer but this is a hard problem, I can't expect to get it right away. I think the lookup logic in the default case of the interpreter is wonky. First we check if the function has a variadic definition, then we check for a fixed arity, otherwise call the variadic, and then look for a fixed arity again? Is that necessary? Wait... it might be actually. Because if the fn is variadic it still might match a fixed arity. I hope that makes sense later because it makes sense now.
- Idk... does Clojure actually allow that ambiguity? Can you have a certain fixed arity and a variadic arity with the same number of args? Let's try it
-
  ``` clojure
	  (defn myfn
	    ([a b c] (str a b c))
	    ([a & b] (str "variadic" a (apply str b))))
	  
	   (myfn "hello" "kitty")
	  "variadichellokitty"
  ```
- ok cool. We first check if there's a matching fixed arity
- I should have the resolve function do all the lookup logic, including the arity stuff.
- `resolve` will just take the ast and the env.
- I think I've got it somewhat close. I'm happy because the code is arranged very logically.
- But it isn't successfully retrieving any vars at all. It calls eval_ast, and it doesn't recognize it as a symbol even though it is.
- ok, finally tracked down that bug.
- Only to reach a new one, of course. For some reason the env is getting lost. So at least I have some idea what the problem is... but it doesn't make sense. I checked every call site and the env is being passed every time.
- Going to take a nap. The problem is pretty obvious... it's printing the env in the console at every point... it's there... and then it isn't
- ## Well I didn't sleep much
	- I'm thinking of changing my attitude by, instead of feeling frustrated that it's not doing what it should... to try to pretend that I want that behavior, and try to understand why it "works".
	- So... I have a magically disappearing environment. How did I manage that?
	- The function is defined in the env properly, as `user/a`. Then it is called.
	- The args are passed to eval_ast, along with the current env.
	- oh my god... I see the bug:
	-
	  ``` js
	  		  var f = EVAL(resolve(ast, env))
	  ```
	- We're passing the env to resolve... but not to EVAL!
	- It still doesn't work. But I solved the env issue.
	- Now it's not finding the `__ast__` property on the function. I'll print it to try to see why.
	- the actual defined function works. But then it calls the function body, which is a call to `str`.
	- It seems like it's evaluating in circles.
	- This is the error I'm getting:
	- `Error: Cannot read properties of null (reading '__ast__')`
	- But how is that possible? It first checks if that property exists before trying to use it. That's how we know if it's a user defined function.
	- That's indeed the line that is reporting the error:
	-
	  ``` js
	  		  if (f.__ast__) {
	  		            console.log("setting env to function scope")
	  		            ast = f.__ast__;
	  		            env = f.__gen_env__(args);
	  ```
	- It's erroring because `f` is null.
	- `resolve` sometimes receives symbols, and sometimes a list. That's the problem I think. We need to make it so if passed
	- waaaaaat... this makes zero sense.
	- omg, I finally got it! Holy shit! That was one of the most intense debugging sessions I ever had... I was missing a return statement in one place.
	- Multi-arity functions are still not working. It prints `Looking for `two-fer/two-fer` in two-fer`, but fails to return it even though `two-fer/two-fer-arity-0` and `two-fer/two-fer-arity-1` are both in the env.
	- Because this is wrong:
	-
	  ``` js
	  		  if (vars[i] === namespace + "/" + varName + '-arity-' + ast.length-1) {
	  ```
	- It's wrong because it's not being called on the entire ast. It's being called on the symbol! I think the only way we can get the actual arity is if we pass it.
	- It worked! Holy shit! Something worked!
	- The gotcha at the moment is that the namespace resolution takes a ridiculous amount of time. I'm hoping it's because I put like 100 prints to the console trying to debug this.
	- Yes! I commented out all the logs and it went just as fast as before!
	- hello world and twofer are now passing, but reverse string is having an env lookup failure.
	- Ah! I got it, it was a silly mistake in the solution. This is great! I think I'll merge it!
	- ok so now there's a bit of a problem, because we're not requiring the namespaces.
	- Until we do... I might just remove the namespace prefixes from the tests.
	- I'm back to 7 exercises passing again! That was intense, these last few days with the namespace stuff.
	- What if... we just check if the function name has a slash (`/`) in it, and if so... just don't resolve it! It will only be 1 or 2 lines!
	- The `prime_factors` exercise is hanging the page
- There seems to be a problem with threading macros.
- We've tried 2 different versions of `reduce`, one in Clojure and one in javascript. The Clojure one hangs for some reason.
- Currently passing: ['roman_numerals', 'two_fer', 'robot_name', 'reverse_string', 'armstrong_numbers', 'hello_world']
- `accumulate` is failing because of the treading macro.
- I don't know when they broke, but this is what is happening:
-
  ``` clojure
	  (-> "hello" (str " kitty"))
	  => (" kitty" "hello")
  ```
- oh... it's because macroexpand was disabled. But I thought I specifically checked that...
- and, it fails to load core with it enabled.
- I'm considering rolling back all the namespace stuff. It feels janky and complicated. But I won't get rid of it yet.
- Or maybe I will...
- Even this fails at `is_macro_call()`: `(do true true)`
- Wait why are we looking in the env for `do`? It's a special form, not a symbol
- Ok, the namespaces are hurting my brain. So I made 2 new branches: namespaces2 (because there is already a `namespaces`), and no-namespaces.
- ['word_count', 'armstrong_numbers', 'two_fer', 'grains', 'reverse_string', 'hello_world', 'roman_numerals', 'robot_name', 'difference_of_squares']
- 1. hello world
	2. two-fer
	3. reverse string
	4. accumulate
	5. series
	6. robot_name
	7. anagram
	8. triangle
	9. word_count
	10. armstrong_numbers
	11. difference_of_squares
	12. roman_numerals
	13. grains

- Multi-arity is broken, and I... can't seem to remember how it's supposed to work!
- cool, fixed
- There's a problem with `and`:
-
  ``` clojure
	  (and true) => 
	  Error: Cannot read properties of null (reading 'length') 
  ```
- Well, I guess now I get to debug a macro
-
  ``` clojure
	  (defmacro and
	    (fn [& xs]
	         (cond (empty? xs)      true
	               (= 1 (count xs)) (first xs)
	               true             
	               (let (condvar (gensym))
	                 `(let (~condvar ~(first xs))
	                    (if ~condvar (and ~@(rest xs)) ~condvar))))))
  ```
- I think the macro is fine... I'm pretty sure I tested it when I ported it. I think there's a bug in my calling logic.
- Actually, the macro will not even expand, `macroexpand` outputs `null`. I wonder if any other macros are broken? Actually I can try this right in the app
- This is madness. I hate it. I'm sure it worked before. But something I've done must be messing it up.
- I just made it a function
-
  ``` clojure
	  (defn and [& xs]
	    (every? #(identity %) xs))
  ```
- Whatever. It works.
- I've got 15 exercises passing again: 'triangle', 'hello_world', 'bob', 'roman_numerals', 'zipper', 'two_fer', 'difference_of_squares', 'grains', 'acronym', 'word_count', 'robot_name', 'reverse_string', 'accumulate', 'anagram', 'series'
- For `bob`, I used js interop:
-
  ``` clojure
	  (defn remove-whitespace [s]
	    (js-eval (str "\"" s "\"" ".replace(/\\s+/g, '')")))
  ```
- # Partition
	- I think I can write this using basic maths.
	- Observe these test cases:
	-
	  ``` clojure
	  		  (partition 4 6 (range 20))
	  		  ;;=> ((0 1 2 3) (6 7 8 9) (12 13 14 15))
	  		  (partition 4 3 (range 20))
	  		  ;;=> ((0 1 2 3) (3 4 5 6) (6 7 8 9) (9 10 11 12) (12 13 14 15) (15 16 17 18))
	  ```
	- As we can see, the nth element of each partition can be computed as a simple `range` with a `step` of `step`, which is the 2nd arg to partition (defaults to n, the first arg)
	- In other words, take the first example, `(partition 4 6 (range 20))`.
	- The first elements of each partition are  `(0 6 12)`.
	- The second of each are `(1 7 13)`, etc.
	- So as we iterate through the array of partitions, we can add the correct item to each inner-array.
	- So our first loop will go from 0 to n, the first arg, which is how many are in each partition, which corresponds to how many `range`s we will generate.
	- Each range begins with its index.
	- Nice! So here are the generated ranges for the first example:
	-
	  ``` clojure
	  		  (partition 4 6 (range 20))
	  		  ;;=> ((0 6 12 18) (1 7 13 19) (2 8 14) (3 9 15))
	  ```
	- Here is the code that produced it:
	-
	  ``` js
	  		  function partition() {
	  		      if (arguments.length === 2) {
	  		          const n = arguments[0]
	  		          const coll = arguments[1]
	  		          return partition(n, n, coll)
	  		      } else if (arguments.length === 3) {
	  		          const n = arguments[0]
	  		          const step = arguments[1]
	  		          const coll = arguments[2]
	  		          let index = 0
	  		          const nParts = Math.floor(coll.size / step)
	  		          var parts = new Array(nParts).fill([]);
	  		          console.log("1st elements", Range(0, coll.size, step).toArray())
	  		          let ranges = []
	  		          for (var i = 0; i < n; i++) {
	  		              ranges.push(Range(i, coll.size, step).toArray())
	  		          }
	  		          return ranges
	  		      }
	  		  }
	  ```
	- So now we just need to take the first element of each range, the second element of each, etc.
	- I did it! Check it out:
	-
	  ``` js
	  		  function partition() {
	  		      if (arguments.length === 2) {
	  		          const n = arguments[0]
	  		          const coll = arguments[1]
	  		          return partition(n, n, coll)
	  		      } else if (arguments.length === 3) {
	  		          const n = arguments[0]
	  		          const step = arguments[1]
	  		          const coll = arguments[2]
	  		          let index = 0
	  		          const nParts = Math.floor(coll.size / step)
	  		          let ranges = []
	  		          for (var i = 0; i < n; i++) {
	  		              ranges.push(Range(i, coll.size, step).toArray())
	  		          }
	  		          let parts = []
	  		          for (let i = 0; i < nParts; i++) {
	  		              parts.push(ranges.map(x => x[i]))
	  		              
	  		          }
	  		          return parts
	  		      }
	  		  }
	  ```
	- This feels really great! It's like, my first time writing what I'd consider *functional javascript*
	- hmm... this causes it to hang: `(partition 8 1 [1 2 5])`
	- Well... Clojure outputs an empty list.
	- This is the test case:
	-
	  ``` clojure
	  		  (deftest false-start
	  		      (is (= :sublist (sublist/classify [1 2 5] [0 1 2 3 1 2 5 6]))))
	  ```
	- `list1` is a `sublist` of `list2`. Here's the `classify` function:
	-
	  ``` clojure
	  		  (defn classify
	  		    "Classifies two lists based on whether coll1 is the same list, a superlist,
	  		    a sublist, or disjoint (unequal) from coll2."
	  		    [coll1 coll2]
	  		    (let [len1 (count coll1)
	  		          len2 (count coll2)]
	  		      (cond
	  		        (= coll1 coll2) :equal
	  		        (and (> len1 len2) (list-contains? coll1 coll2)) :superlist
	  		        (and (> len2 len1) (list-contains? coll2 coll1)) :sublist
	  		        :else :unequal)))
	  ```
	- It's not a superlist per the second condition (`(and (> len1 len2) (list-contains? coll1 coll2))`).
	- And here is an example of where `and` needs to not evaluate the second item, because `(> len1 len2)` evaluates to `false`. So that's the problem. And the `and` macro is fucked and so we're currently using a regular function which evaluates all its args.
	- So if we can't fix `and` atm, in the meantime we could just change it to an `if`, like this:
	-
	  ``` clojure
	  		  (if (> len1 len2)
	  		    (list-contains? coll1 coll2)
	  		    false)
	  ```
	- Complete solution:
	-
	  ``` clojure
	  		  (ns sublist)
	  		  
	  		  (defn- list-contains?
	  		    "Returns truthy when list2 is contained within list1, nil otherwise"
	  		    [list1 list2]
	  		    (some #(when (= % list2) val)
	  		          (partition (count list2) 1 list1)))
	  		  
	  		  (defn classify
	  		    "Classifies two lists based on whether coll1 is the same list, a superlist,
	  		    a sublist, or disjoint (unequal) from coll2."
	  		    [coll1 coll2]
	  		    (let [len1 (count coll1)
	  		          len2 (count coll2)]
	  		      (cond
	  		        (= coll1 coll2) :equal
	  		        (if (> len1 len2) (list-contains? coll1 coll2) false) :superlist
	  		        (if (> len2 len1) (list-contains? coll2 coll1) false) :sublist
	  		        :else :unequal)))
	  ```
	- Damn. It still hangs.
	- This is the offending form:
	-
	  ``` clojure
	  		  (def coll1 [1 2 5])
	  		  (def coll2 [0 1 2 3 1 2 5 6])
	  		  (list-contains? coll2 coll1)
	  ```
	- So the problem is actually in the `list-contains?` part:
	-
	  ``` clojure
	  		  (defn- list-contains?
	  		    "Returns truthy when list2 is contained within list1, nil otherwise"
	  		    [list1 list2]
	  		    (some #(when (= % list2) val)
	  		          (partition (count list2) 1 list1)))
	  		  
	  		  (def coll1 [1 2 5])
	  		  (def coll2 [0 1 2 3 1 2 5 6])
	  		  (def len1 (count coll1))
	  		  (def len2 (count coll2))
	  		  
	  		  (> len1 len2)
	  		  (> len2 len1)
	  		  
	  		  (def list1 coll2)
	  		  (def list2 coll1)
	  		  
	  		  (partition (count list2) 1 list1)
	  		  (partition 3 1 [0 1 2 3 1 2 5 6])
	  ```
	- In Clojure, it correctly returns this:
	-
	  ``` clojure
	  		  (partition 3 1 [0 1 2 3 1 2 5 6])
	  		  ;;=> ((0 1 2) (1 2 3) (2 3 1) (3 1 2) (1 2 5) (2 5 6))
	  ```
	- And ours hangs. Why is that?
	- It crashes before it even generates the ranges, in the first step:
	-
	  ``` js
	  		  function partition() {
	  		      if (arguments.length === 2) {
	  		          const n = arguments[0]
	  		          const coll = arguments[1]
	  		          return partition(n, n, coll)
	  		      } else if (arguments.length === 3) {
	  		          const n = arguments[0]
	  		          const step = arguments[1]
	  		          const coll = arguments[2]
	  		          const nParts = Math.floor(coll.size / step)
	  		          const ranges = Range(0, n).map(i => Range(i, coll.size, step).toArray())
	  		          return ranges
	  		          //const parts = Range(0, nParts).map(i => ranges.map(x => x[i]))
	  		          //return parts
	  		      }
	  		  }
	  ```
	-
	  ``` clojure
	  		  (partition 3 1 [0 1 2 3 1 2 5 6]) => 
	  		  Error: Cannot perform this action with an infinite size. 
	  ```
	- Weird, isn't it?
	- It's taking `Range(0, n)` and mapping `i => Range(i, coll.size, step).toArray()` on it.
	- Replacing it with the values, it's `Range(0, 3).map(i => Range(i, coll.size, step).toArray()`
	- Hmmm. I believe `coll` needs to be a `seq`. Or... we use `.length()`?
	- Yes! Ok! That worked!
	- But the solution still crashes. What else is wrong?
	- It's indeed wrong. Here's the output in Clojure:
	-
	  ``` clojure
	  		  (partition 3 1 [0 1 2 3 1 2 5 6])
	  		  ;;=>((0 1 2) (1 2 3) (2 3 1) (3 1 2) (1 2 5) (2 5 6))
	  ```
	- Oh, wait. Derp. I forgot to uncomment the end of the partition function!
	- Ah. The reason I had coll.size before is it was using a `Range` from immutable.js, which is an indexed seq. So let's just convert whatever the coll is to one of those and we should be in business.
	- I think I know the problem. We need to take the element at the index of the seq... not the index which we were doing because it was a `range`. See:
	-
	  ``` clojure
	  		  (partition 3 1 [0 1 2 3 1 2 5 6])
	  		  => ((0 1 2 3 4 5 6 7) (1 2 3 4 5 6 7) (2 3 4 5 6 7))
	  ```
	- So like... it doesn't even make sense to use a `range`. Err... perhaps it does, but as I mentioned above, we don't do `Range(i, seq.size, step)`, we do `Range(seq.get(i), seq.size, step)`.
	- Wait no... let's back up...
	- We're not even making the correct number of parts. I'm thinking it is `seq.size` divided by `n`, divided by `step`, floored. Let's see if that makes sense. Uh, no it doesn't.
	- `(partition 3 1 [0 1 2 3 1 2 5 6])` gets split into 6 parts.
	- omg this should be so easy. I could do it in Clojure... I'm getting confused by `map`, because I'm used to the collection being mapped on being at the end. So if I solve it in Clojure, it should be easier to see how to translate it.
	- omg my brain is so broken.
	- Let's go over this again.
	- Here are the test cases:
	-
	  ```
	  		  (partition 4 6 (range 20))
	  		  ;;=> ((0 1 2 3) (6 7 8 9) (12 13 14 15))
	  		  (partition 4 3 (range 20))
	  		  ;;=> ((0 1 2 3) (3 4 5 6) (6 7 8 9) (9 10 11 12) (12 13 14 15) (15 16 17 18))
	  		  (partition 3 1 [0 1 2 3 1 2 5 6])
	  		  ;;=> ((0 1 2) (1 2 3) (2 3 1) (3 1 2) (1 2 5) (2 5 6))
	  ```
- There's 20 solutions passing:
- `['series', 'anagram', 'reverse_string', 'roman_numerals', 'binary_search', 'accumulate', 'robot_name', 'hello_world', 'grains', 'complex_numbers', 'word_count', 'raindrops', 'difference_of_squares', 'bob', 'two_fer', 'zipper', 'leap', 'acronym', 'octal', 'triangle']`
- 5 more than previous list:
- ` 'triangle', 'hello_world', 'bob', 'roman_numerals', 'zipper', 'two_fer', 'difference_of_squares', 'grains', 'acronym', 'word_count', 'robot_name', 'reverse_string', 'accumulate', 'anagram', 'series'`
- # `cycle`
	- I could have sworn there was a `cycle` in immutable.js, but I guess that must have been one of those other lazy seq libs. It was like, one of the core abstractions.
	- It could be that it's trivially made with Seq and repeat or something.
	- `clojure.core` is no help here, it just creates a `clojure.lang.Cycle` object from the coll passed to it. So I'll do something like that too.
	- It could be as simple as vectors, which are normal arrays, like lists, only with a marker `__is_vector__`, and we check for it wherever it matters. So cycle could be just like that, just a normal list marked `__is_cycle__`., and whatever functions need to consume cycles can see it's a cycle, and however many items are needed will be calculated via modulo or whatever. Sounds like a no brainer, but I might not have thought of it if I hadn't saw that Clojure implements a special type for it.
	- Here is `vec`:
	-
	  ``` js
	  		  function vec(lst) {
	  		      if (types._list_Q(lst)) {
	  		          var v = Array.prototype.slice.call(lst, 0);
	  		          v.__isvector__ = true;
	  		          return v;
	  		      } else {
	  		          return lst;
	  		      }
	  		  }
	  ```
	- This is what I've got:
	-
	  ``` js
	  		  function cycle(coll) {
	  		      var c = seq(coll)
	  		      c.__iscycle__ = true;
	  		      return c
	  		  }
	  ```
	- Right now, it simply returns a list:
	-
	  ``` clojure
	  		  (cycle [1 2 3]) => (1 2 3) 
	  ```
	- What happens if we evaluate that in Clojure? Does it error or something?
	- LOL, no it actually starts spitting infinitely!
	- I actually don't know why `vec` only creates a vector if passed a list, and returns it unchanged otherwise. Wouldn't it want to like, make it a list?
	- Let's see where `cycle` is actually used in our corpus. We should start to make a habit of that because it's weird that I haven't done that yet!
	- It's only used 3 times. In sieve, luhn and robot_simulator.
	-
	  ``` clojure
	  		  (defn sieve
	  		    "Returns a list of primes less than or equal to limit"
	  		    [limit]
	  		    (loop [current-sieve (concat [false false] (range 2 (inc limit)))
	  		           last-prime 1]
	  		      (let [current-prime (->> current-sieve
	  		                               (drop (inc last-prime))
	  		                               (some identity))]
	  		        (if current-prime
	  		          (recur (map #(and %1 %2)
	  		                      (concat (repeat (inc current-prime) true)
	  		                              (cycle (concat (repeat (dec current-prime) true)
	  		                                             [false])))
	  		                      current-sieve)
	  		                 current-prime)
	  		          (filter identity current-sieve)))))
	  ```
	-
	  ``` clojure
	  		  (defn to-reversed-digits
	  		    "returns a lazy sequence of least to most significant digits of n"
	  		    [n]
	  		    (->> [n 0]
	  		         (iterate (fn [[i _]] [(quot i 10) (mod i 10)]))
	  		         (take-while (complement #{[0 0]}))
	  		         (map second)
	  		         rest))
	  		  
	  		  (defn checksum
	  		    "returns the luhn checksum of n, assuming it has a check digit"
	  		    [n]
	  		    (-> (->> n
	  		             to-reversed-digits
	  		             (map * (cycle [1 2]))
	  		             (map #(if (>= % 10) (- % 9) %))
	  		             (apply +))
	  		        (mod 10)))
	  ```
	-
	  ``` clojure
	  		  (def directions [:north :east :south :west])
	  		  
	  		  (defn robot [coordinates bearing]
	  		    {:coordinates coordinates :bearing bearing})
	  		  
	  		  (defn turn [bearing direction-list]
	  		    (let [dir-stream (drop-while #(not (= bearing %1)) (cycle direction-list))]
	  		      (nth dir-stream 1)))
	  ```
	- The `sieve` implementation is the hardest to understand. There isn't an obvious point where the cycle is realized, like `take` or something.
	- I should find as many examples as possible. From ClojureDocs:
	-
	  ``` clojure
	  		  (take 5 (cycle ["a" "b"]))
	  		  ("a" "b" "a" "b" "a")
	  ```
	-
	  ``` clojure
	  		  ;; Typically map works through its set of collections
	  		  ;; until any one of the collections is consumed.
	  		  ;; 'cycle' can be used to repeat the shorter collections
	  		  ;; until the longest collection is consumed.
	  		  (mapv #(vector %2 %1) (cycle [1 2 3 4]) [:a :b :c :d :e :f :g :h :i :j :k :l])
	  		  ;;=> [[:a 1] [:b 2] [:c 3] [:d 4] [:e 1] [:f 2] [:g 3] [:h 4] [:i 1] [:j 2] [:k 3] [:l 4]]
	  ```
	- Speaking of which, we need to make `map` work on multiple collections. `hamming` is a good example of that.
	