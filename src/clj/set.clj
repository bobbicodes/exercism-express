(ns clj.set)

(defn- bubble-max-key 
   "Move a maximal element of coll according to fn k (which returns a number) 
     to the front of coll."
  [k coll]
  (let [max (apply max-key k coll)]
    (cons max (remove #(= max %) coll))))

(defn set/union
  "Return a set that is the union of the input sets"
  ([] #{})
  ([s1] s1)
  ([s1 s2]
   (if (< (count s1) (count s2))
     (do (prn "s1:" s1 "s2:" s2)
         (reduce conj s2 s1))
     (do (prn "s1:" s1 "s2:" s2)
         (reduce conj s1 s2))))
  ([s1 s2 & sets]
   (let [bubbled-sets (bubble-max-key count (conj sets s2 s1))]
     (do (prn "bubbled-sets:" bubbled-sets)
         (reduce into (first bubbled-sets) (rest bubbled-sets))))))

