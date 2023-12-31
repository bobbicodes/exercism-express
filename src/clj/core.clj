(ns core {:clj-kondo/ignore true})

(def not (fn [a] (if a false true)))

(defmacro cond 
  (fn [& xs] 
    (if (> (count xs) 0)
      (list 'if (first xs) 
            (if (> (count xs) 1)
              (nth xs 1) (throw \\"odd number of forms to cond \\")) 
            (cons 'cond (rest (rest xs)))))))

(def dec (fn (a) (- a 1)))
(def zero? (fn (n) (= 0 n)))
(def identity (fn (x) x))

#_(defn reduce [f init xs]
  (if (empty? xs)
    init
    (reduce f (f init (first xs)) (rest xs))))

(defn _iter-> [acc form] 
    (if (list? form) 
      `(~(first form) ~acc ~@(rest form)) 
      (list form acc)))

(defmacro -> (fn [x & xs] (reduce _iter-> x xs)))

(defn _iter->> [acc form] 
  (if (list? form) 
    `(~(first form) ~@(rest form) ~acc) (list form acc)))

(defmacro ->> (fn (x & xs) (reduce _iter->> x xs)))

(def gensym
  (let [counter (atom 0)]
    (fn []
      (symbol (str \\"G__\\" (swap! counter inc))))))

(defn memoize [f]
    (let [mem (atom {})]
      (fn [& args]
        (let [key (str args)]
          (if (contains? @mem key)
            (get @mem key)
            (let [ret (apply f args)]
              (do
                (swap! mem assoc key ret)
                ret)))))))

(defn partial [pfn & args]
  (fn [& args-inner]
    (apply pfn (concat args args-inner))))

(defn every? [pred xs]
  (cond (empty? xs)       true
        (pred (first xs)) (every? pred (rest xs))
        true              false))

;(defn reverse [coll] (reduce conj () (seq coll)))

(defmacro when (fn [x & xs] (list 'if x (cons 'do xs))))

(defmacro if-not 
  (fn [test then else]
    `(if (not ~test) ~then ~else)))

(defmacro when-not 
  (fn [test & body]
    (list 'if test nil (cons 'do body))))

(defn fnext [x] (first (next x)))

(defmacro or
  (fn [& xs]
    (if (empty? xs) nil
      (if (= 1 (count xs))
        (first xs)
        (let [condvar (gensym)]
          `(let [~condvar ~(first xs)]
             (if ~condvar ~condvar (or ~@(rest xs)))))))))

#_(defmacro and
  (fn [& xs]
       (cond (empty? xs)      true
             (= 1 (count xs)) (first xs)
             true             
             (let [condvar (gensym)]
               `(let [~condvar ~(first xs)]
                  (if ~condvar (and ~@(rest xs)) ~condvar))))))

(defn and [& xs]
  (every? #(identity %) xs))

(defn ffirst [x] (first (first x)))

(defn second [l] (nth l 1))

(defn some [pred xs] 
  (if (empty? xs) 
    nil 
    (or (pred (first xs)) 
        (some pred (rest xs)))))

(defmacro time
  (fn (exp)
    (let [start (gensym)
          ret   (gensym)]
      `(let (~start (time-ms)
                      ~ret   ~exp)
           (str
            \\"(Elapsed time: \\" (- (time-ms) ~start) \\"msecs) \\" ~ret)))))

(defn load-file [f] 
  (eval (read-string (str \\"(do \\" (slurp f) \\"\nnil)\\"))))

(defn pow [base pow]
  (reduce * 1 (repeat pow base)))

(defmacro when-let
  (fn [bindings & body]
    (let [form (first bindings) tst (last bindings)]
      `(let [temp# ~tst]
         (when temp#
           (let [~form temp#]
             ~@body))))))

(defn butlast [s]
  (take (dec (count s)) s))

(defn interleave [c1 c2]
  (loop [s1  (seq c1)
         s2  (seq c2)
         res []]
    (if (or (empty? s1) (empty? s2))
      res
      (recur (rest s1) 
             (rest s2) 
             (cons (first s1) (cons (first s2) res))))))

(defn take-nth
  "Returns a seq of every nth item in coll."
  [n coll]
  (loop [c coll res []]
    (if (empty? c)
      (seq res)
      (recur (drop n (seq c))
             (conj res (first (seq c)))))))

(defn into [to from]
  (reduce conj to from))

(defn blank? [s]
  (= (trim s) ""))

(defn isLetter
  [x]
    (not= (upper-case x)
          (lower-case x)))

(defn fromCharCode [int]
  (js-eval (str "String.fromCharCode(" int ")")))

(defn isAlphabetic
  "Takes a Unicode code point."
  [int]
  (not= (upper-case (fromCharCode int))
        (lower-case (fromCharCode int))))

(defn isUpperCase
  "Takes either a char or a Unicode code point."
  [x]
  (if (int? x)
    (and (isLetter (fromCharCode x))
         (= (fromCharCode x)
            (upper-case (fromCharCode x))))
    (and (isLetter x)
         (= x (upper-case x)))))

(defn isLowerCase
  "Takes either a char or a Unicode code point."
  [x]
  (if (int? x)
    (and (isLetter (fromCharCode x))
         (= (fromCharCode x)
            (lower-case (fromCharCode x))))
    (and (isLetter x)
         (= x (lower-case x)))))

(defn even? [n] (= 0 (mod n 2)))
(defn odd? [n] (= 1 (mod n 2)))

(defn complement [f]
  (fn [x y & zs] 
    (if zs
      (not (apply f x y zs))
      (if y
        (not (f x y))
        (if x
          (not (f x))
          (not (f)))))))

(defn neg? [n]
  (> 0 n))

(defn pos? [n]
  (> n 0))

(defn quot [n d]
  (int (/ n d)))

#_(defn frequencies [coll]
   (reduce (fn [counts x]
             (assoc counts x (inc (get counts x 0))))
           {} coll))

(defn nthrest [coll1 n1]
  (loop [n1 n1 xs coll1]
    (if-not (and (pos? n1) (seq xs))
      xs
      (recur (dec n1) (rest xs)))))

(defn partition [n step coll]
  (if-not coll 
    (partition n n step)
    (loop [s coll p []]
      (if (= 0 (count s))
        (filter #(= n (count %)) p)
        (recur (drop step s)
               (conj p (take n s)))))))

(defn max-key
  "Returns the x for which (k x), a number, is greatest.
  If there are multiple such xs, the last one is returned."
  ([k x] x)
  ([k x y] (if (> (k x) (k y)) x y))
  ([k x y & more]
   (let [kx (k x) ky (k y)
         [v kv] (if (> kx ky) [x kx] [y ky])]
     (loop [v v kv kv more more]
       (if more
         (let [w (first more)
               kw (k w)]
           (if (>= kw kv)
             (recur w kw (next more))
             (recur v kv (next more))))
         v)))))

;; for

(defn to-groups [seq-exprs]
  (reduce (fn [groups binding]
            (if (keyword? (first binding))
              (conj (pop groups) (conj (peek groups) [(first binding) (last binding)]))
              (conj groups [(first binding) (last binding)])))
          [] (partition 2 seq-exprs)))

